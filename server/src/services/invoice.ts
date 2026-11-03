import PDFDocument from 'pdfkit';
import { Types } from 'mongoose';
import { HttpError } from '../middleware/errors';
import { Item } from '../models/Item';
import { Order } from '../models/Order';
import { User } from '../models/User';
import { env } from '../config/env';

const rupeeFont =
  require.resolve('@fontsource/noto-sans/files/noto-sans-devanagari-400-normal.woff');

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

async function loadInvoiceLogo() {
  if (!env.INVOICE_LOGO_URL) {
    const { readFile } = await import('node:fs/promises');
    const { resolve } = await import('node:path');
    return readFile(resolve(__dirname, '../../../client/public/resello-logo.png'));
  }

  const logoUrl = new URL(env.INVOICE_LOGO_URL);
  if (logoUrl.protocol !== 'https:' || !logoUrl.pathname.includes('/storage/v1/object/public/')) {
    throw new Error('INVOICE_LOGO_URL must be an HTTPS public Supabase Storage object URL.');
  }

  const response = await fetch(logoUrl, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) {
    throw new Error(`Could not load invoice logo from Supabase Storage (${response.status}).`);
  }
  const contentType = response.headers.get('content-type')?.split(';')[0].trim();
  if (contentType !== 'image/png' && contentType !== 'image/jpeg') {
    throw new Error('The invoice logo URL must return a PNG or JPEG image.');
  }
  const contentLength = Number(response.headers.get('content-length') ?? 0);
  if (contentLength > 5_000_000) {
    throw new Error('The invoice logo image must be no larger than 5 MB.');
  }

  const image = Buffer.from(await response.arrayBuffer());
  if (image.length > 5_000_000) {
    throw new Error('The invoice logo image must be no larger than 5 MB.');
  }
  return image;
}

function drawAmount(
  document: PDFKit.PDFDocument,
  amount: number,
  x: number,
  y: number,
  width: number,
  fontSize = 10,
  bold = false,
) {
  const number = amount.toFixed(2);
  document.font('InvoiceRupee').fontSize(fontSize);
  const symbolWidth = document.widthOfString('₹');
  const numberFont = bold ? 'Helvetica-Bold' : 'Helvetica';
  document.font(numberFont).fontSize(fontSize);
  const numberWidth = document.widthOfString(number);
  const symbolX = x + width - symbolWidth - numberWidth - 2;
  document.font('InvoiceRupee').fontSize(fontSize).text('₹', symbolX, y, { lineBreak: false });
  document
    .font(numberFont)
    .fontSize(fontSize)
    .text(number, symbolX + symbolWidth + 2, y, { lineBreak: false });
}

function pickupLabel(preference: string | null | undefined) {
  const labels: Record<string, string> = {
    ON_CAMPUS: 'On campus',
    HOSTEL_GATE: 'Hostel gate',
    DEPARTMENT: 'Department building',
  };
  return preference ? (labels[preference] ?? preference) : '';
}

export async function createBuyerOrderInvoice(userId: string, orderId: string) {
  if (!Types.ObjectId.isValid(orderId)) {
    throw new HttpError(400, 'INVALID_ORDER_ID', 'The order ID is invalid.');
  }

  const buyerObjectId = new Types.ObjectId(userId);
  const order = await Order.findById(orderId).lean();
  if (!order) throw new HttpError(404, 'ORDER_NOT_FOUND', 'This order could not be found.');
  if (!order.buyerId.equals(buyerObjectId)) {
    throw new HttpError(
      403,
      'ORDER_FORBIDDEN',
      'Only the buyer on this order can download its invoice.',
    );
  }
  if (order.status !== 'COMPLETED') {
    throw new HttpError(
      409,
      'ORDER_NOT_COMPLETED',
      'An invoice is available only after the order is fully completed.',
    );
  }

  const [buyer, seller, item, logo] = await Promise.all([
    User.findById(order.buyerId).select('name email').lean(),
    User.findById(order.sellerId).select('name email phone pickupPreference').lean(),
    Item.findById(order.itemId).select('title').lean(),
    loadInvoiceLogo(),
  ]);

  const invoice = {
    invoiceNumber: `RES-${order._id.toString().toUpperCase()}`,
    issuedAt: new Date(),
    orderId: order._id.toString(),
    orderDate: order.createdAt,
    orderStatus: order.status,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    buyerName: buyer?.name ?? 'Unavailable account',
    buyerEmail: buyer?.email ?? 'Unavailable',
    sellerName: seller?.name ?? 'Unavailable account',
    sellerEmail: seller?.email ?? 'Unavailable',
    sellerPhone: seller?.phone ?? '',
    sellerPickup: pickupLabel(seller?.pickupPreference),
    handoverNotes: order.deliveryNotes.trim(),
    itemTitle: order.itemTitle ?? item?.title ?? 'Unavailable item',
    quantity: 1,
    unitPrice: Number(order.price),
    total: Number(order.price),
  };
  const applicationUrl = env.INVOICE_APP_URL || env.CLIENT_ORIGIN;

  const document = new PDFDocument({ size: 'A4', margin: 52, compress: false });
  document.registerFont('InvoiceRupee', rupeeFont);
  const chunks: Buffer[] = [];
  const pdf = new Promise<Buffer>((resolve, reject) => {
    document.on('data', (chunk: Buffer) => chunks.push(chunk));
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.on('error', reject);
  });

  document.info.Title = `Resello order invoice ${invoice.invoiceNumber}`;
  document.info.Author = 'Resello';

  const left = document.page.margins.left;
  const right = document.page.width - document.page.margins.right;
  const width = right - left;
  const headerY = document.y;
  document.image(logo, left, headerY, { fit: [126, 64] });
  document
    .fillColor('#0f172a')
    .font('Helvetica-Bold')
    .fontSize(19)
    .text('Order invoice', left + 170, headerY + 8, { width: width - 170, align: 'right' });
  document
    .fillColor('#0f766e')
    .font('Helvetica')
    .fontSize(9)
    .text(applicationUrl, left + 170, headerY + 37, {
      width: width - 170,
      align: 'right',
      link: applicationUrl,
    });
  document.y = headerY + 78;
  document
    .fillColor('#475569')
    .font('Helvetica')
    .fontSize(9)
    .text('Campus marketplace order record - not a tax invoice.');
  document.moveDown(0.6);

  const divider = (color = '#cbd5e1') => {
    const y = document.y + 5;
    document.moveTo(left, y).lineTo(right, y).lineWidth(0.8).strokeColor(color).stroke();
    document.y = y + 14;
  };
  const sectionTitle = (title: string, x = left, y = document.y) => {
    document.fillColor('#0f766e').font('Helvetica-Bold').fontSize(10).text(title, x, y);
  };
  const metadata = [
    ['Invoice number', invoice.invoiceNumber],
    ['Invoice date', formatDate(invoice.issuedAt)],
    ['Order number', invoice.orderId],
    ['Order date', formatDate(invoice.orderDate)],
    ['Order status', invoice.orderStatus],
    ['Payment method', invoice.paymentMethod],
  ];
  const metadataY = document.y;
  metadata.forEach(([title, value], index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = left + column * (width / 2);
    const y = metadataY + row * 34;
    document.fillColor('#64748b').font('Helvetica').fontSize(8).text(title.toUpperCase(), x, y);
    document
      .fillColor('#0f172a')
      .font('Helvetica-Bold')
      .fontSize(9)
      .text(value, x, y + 12, { width: width / 2 - 12 });
  });
  document.y = metadataY + 105;
  divider();

  const peopleY = document.y;
  const personColumnWidth = width / 2 - 14;
  sectionTitle('BUYER', left, peopleY);
  sectionTitle('SELLER', left + width / 2 + 14, peopleY);
  document
    .fillColor('#0f172a')
    .font('Helvetica-Bold')
    .fontSize(9)
    .text(invoice.buyerName, left, peopleY + 15, { width: personColumnWidth });
  document
    .font('Helvetica')
    .fillColor('#475569')
    .fontSize(8)
    .text(invoice.buyerEmail, left, peopleY + 28, { width: personColumnWidth });
  const sellerX = left + width / 2 + 14;
  document
    .fillColor('#0f172a')
    .font('Helvetica-Bold')
    .fontSize(9)
    .text(invoice.sellerName, sellerX, peopleY + 15, { width: personColumnWidth });
  document
    .font('Helvetica')
    .fillColor('#475569')
    .fontSize(8)
    .text(invoice.sellerEmail, sellerX, peopleY + 28, { width: personColumnWidth });
  let sellerDetailY = peopleY + 41;
  if (invoice.sellerPhone) {
    document.text(`Phone: ${invoice.sellerPhone}`, sellerX, sellerDetailY, {
      width: personColumnWidth,
    });
    sellerDetailY += 12;
  }
  if (invoice.sellerPickup) {
    document.text(`Meetup: ${invoice.sellerPickup}`, sellerX, sellerDetailY, {
      width: personColumnWidth,
    });
  }
  document.y = peopleY + 67;
  divider();

  const headerRowY = document.y;
  document.fillColor('#0f172a').font('Helvetica-Bold').fontSize(8);
  document.text('ITEM', left, headerRowY, { width: 225 });
  document.text('QTY', left + 250, headerRowY, { width: 35, align: 'right' });
  document.text('UNIT PRICE', left + 300, headerRowY, { width: 80, align: 'right' });
  document.text('TOTAL', right - 78, headerRowY, { width: 78, align: 'right' });
  document.y = headerRowY + 17;
  divider();

  const itemY = document.y;
  document.fillColor('#0f172a').font('Helvetica').fontSize(9);
  document.text(invoice.itemTitle, left, itemY, { width: 225 });
  document.text(String(invoice.quantity), left + 250, itemY, { width: 35, align: 'right' });
  drawAmount(document, invoice.unitPrice, left + 300, itemY, 80, 9);
  drawAmount(document, invoice.total, right - 78, itemY, 78, 9);
  document.y = itemY + Math.max(16, document.heightOfString(invoice.itemTitle, { width: 225 })) + 5;
  divider();

  const summaryRow = (description: string, amount: number, bold = false) => {
    const rowY = document.y;
    document
      .fillColor(bold ? '#0f172a' : '#475569')
      .font(bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(bold ? 11 : 9)
      .text(description, left + 250, rowY, { width: 165 });
    drawAmount(document, amount, right - 95, rowY, 95, bold ? 11 : 9, bold);
    document.y = rowY + (bold ? 22 : 16);
  };
  summaryRow('Items subtotal', invoice.total);
  summaryRow('Shipping / campus delivery', 0);
  summaryRow('Taxes and platform fees', 0);
  divider('#0f766e');
  summaryRow('ORDER TOTAL', invoice.total, true);
  document.moveDown(0.15);

  const detailsY = document.y;
  sectionTitle('PAYMENT', left, detailsY);
  document
    .fillColor('#475569')
    .font('Helvetica')
    .fontSize(8)
    .text(
      `Status: ${invoice.paymentStatus === 'PENDING_COLLECTION' ? 'Pending collection' : invoice.paymentStatus}`,
      left,
      detailsY + 14,
      { width: personColumnWidth },
    );
  document.text('Cash is payable directly to the seller at campus handover.', left, detailsY + 27, {
    width: personColumnWidth,
  });

  const handoverX = sellerX;
  sectionTitle('CAMPUS HANDOVER', handoverX, detailsY);
  const handoverParts = [invoice.sellerPickup, invoice.handoverNotes]
    .filter(Boolean)
    .map((value) => value);
  const handoverText = handoverParts.length
    ? handoverParts.join(' - ')
    : 'The buyer and seller should agree on a campus meeting point.';
  document
    .fillColor('#475569')
    .font('Helvetica')
    .fontSize(8)
    .text(handoverText, handoverX, detailsY + 14, {
      width: personColumnWidth,
      lineGap: 1,
    });
  const handoverHeight = document.heightOfString(handoverText, {
    width: personColumnWidth,
    lineGap: 1,
  });
  document.y = Math.max(detailsY + 57, detailsY + 14 + handoverHeight + 6);
  divider();

  document
    .fillColor('#64748b')
    .font('Helvetica')
    .fontSize(8)
    .text(
      'Resello adds no shipping charge, tax, or platform fee to this peer-to-peer order. The ' +
        'buyer and seller arrange the campus handover directly. Items are sold as-is between ' +
        'peers; the buyer and seller should agree on the item condition at handover. Resello is ' +
        'not the seller. This document records the order and is not a GST or other tax invoice.',
      { width, lineGap: 2 },
    );
  document.end();

  return { invoiceNumber: invoice.invoiceNumber, pdf: await pdf };
}
