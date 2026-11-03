const state = {
  messages: [],
  total: 0,
  start: 0,
  limit: 50,
  filter: 'inbox',
  query: '',
  selectedId: null,
  loading: false,
};

const elements = {
  list: document.querySelector('#message-list'),
  listError: document.querySelector('#list-error'),
  statusError: document.querySelector('#status-error'),
  unread: document.querySelector('#unread-count'),
  search: document.querySelector('#search-input'),
  listStatus: document.querySelector('#list-status'),
  pageCount: document.querySelector('#page-count'),
  readerPanel: document.querySelector('#reader-panel'),
  inboxPanel: document.querySelector('#inbox-panel'),
  detail: document.querySelector('#message-detail'),
  older: document.querySelector('#older-button'),
};

const icon = {
  file: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v6h5"/></svg>',
};

function escapeHtml(value = '') {
  return String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character],
  );
}

function formatDate(value, compact = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
  }
  return new Intl.DateTimeFormat(
    undefined,
    compact ? { month: 'short', day: 'numeric' } : { dateStyle: 'medium', timeStyle: 'short' },
  ).format(date);
}

function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function senderLabel(message) {
  return message.From?.Name || message.From?.Address || 'Unknown sender';
}

function senderAddress(message) {
  if (message.From?.Name && message.From?.Address) {
    return `${message.From.Name} <${message.From.Address}>`;
  }
  return message.From?.Address || message.From?.Name || 'Unknown sender';
}

function recipientsLabel(recipients = []) {
  return recipients
    .map((recipient) =>
      recipient.Name ? `${recipient.Name} <${recipient.Address}>` : recipient.Address,
    )
    .join(', ');
}

function visibleMessages() {
  const query = state.query.trim().toLowerCase();
  return state.messages.filter((message) => {
    const matchesFilter = state.filter !== 'unread' || !message.Read;
    const searchText = [
      message.Subject,
      message.Snippet,
      senderLabel(message),
      message.From?.Address,
      ...(message.To || []).map((recipient) => recipient.Address),
    ]
      .join(' ')
      .toLowerCase();
    return matchesFilter && (!query || searchText.includes(query));
  });
}

function updateCounts(payload) {
  elements.unread.textContent = payload.unread || 0;
  elements.pageCount.textContent = payload.total
    ? `${payload.start + 1}–${Math.min(payload.start + payload.count, payload.total)} of ${payload.total}`
    : '';
  elements.older.disabled = state.start + state.limit >= payload.total;
}

function emptyMarkup() {
  if (state.query) {
    return '<div class="empty-state"><svg viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4 4"/></svg><strong>No matching messages</strong><p>Try a different sender, subject, or search term.</p></div>';
  }
  if (state.filter === 'unread') {
    return '<div class="empty-state"><svg viewBox="0 0 24 24"><path d="M4 4h16v16H4zM4 13h4l2 3h4l2-3h4"/></svg><strong>You’re all caught up</strong><p>Unread development emails will appear here.</p></div>';
  }
  return '<div class="empty-state"><svg viewBox="0 0 24 24"><path d="M3 6.5 12 13l9-6.5M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/></svg><strong>Your inbox is empty</strong><p>When Resello sends a local verification or password-reset email, it will show up here.</p></div>';
}

function renderList() {
  const messages = visibleMessages();
  elements.listStatus.textContent =
    state.filter === 'unread' ? 'Unread' : state.filter === 'all' ? 'All mail' : 'Inbox';

  if (!messages.length) {
    elements.list.innerHTML = emptyMarkup();
    return;
  }

  const rows = messages
    .map((message) => {
      const sender = escapeHtml(senderLabel(message));
      const subject = escapeHtml(message.Subject || '(no subject)');
      const snippet = escapeHtml(message.Snippet || '');
      const selected = state.selectedId === message.ID ? ' selected' : '';
      const readState = message.Read ? 'read' : 'unread';
      return `
      <div class="email-row ${readState}${selected}" role="listitem" tabindex="0" data-id="${escapeHtml(message.ID)}" aria-label="${message.Read ? 'Read' : 'Unread'} email from ${sender}: ${subject}">
        <span class="sender">${sender}</span>
        <span class="subject-snippet"><strong>${subject}</strong><span> — ${snippet}</span></span>
        <time class="row-date" datetime="${escapeHtml(message.Created || '')}">${escapeHtml(formatDate(message.Created, true))}</time>
      </div>`;
    })
    .join('');

  const more =
    state.start + state.limit < state.total
      ? '<button class="load-more" id="load-more" type="button">Load older messages</button>'
      : '';
  elements.list.innerHTML = rows + more;
  elements.list.querySelectorAll('.email-row').forEach((row) => {
    row.addEventListener('click', (event) => {
      openMessage(row.dataset.id);
    });
    row.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openMessage(row.dataset.id);
      }
    });
  });
  elements.list.querySelector('#load-more')?.addEventListener('click', () => {
    state.start += state.limit;
    loadMessages(false);
  });
}

async function loadMessages(reset = true) {
  if (state.loading) return;
  state.loading = true;
  elements.listError.classList.add('hidden');
  if (reset) {
    state.start = 0;
    elements.list.innerHTML =
      '<div class="loading-state"><span class="spinner"></span> Loading your local inbox…</div>';
  }
  try {
    const params = new URLSearchParams({ start: String(state.start), limit: String(state.limit) });
    const response = await fetch(`/api/v1/messages?${params}`);
    if (!response.ok) throw new Error(`Mailpit returned HTTP ${response.status}`);
    const payload = await response.json();
    state.messages = reset
      ? payload.messages || []
      : [...state.messages, ...(payload.messages || [])];
    state.total = payload.total || 0;
    updateCounts(payload);
    renderList();
  } catch (error) {
    elements.listError.textContent = `Could not connect to Mailpit. ${error.message}`;
    elements.listError.classList.remove('hidden');
    elements.list.innerHTML =
      '<div class="error-state">Check that the Mailpit service is running, then try again.</div>';
  } finally {
    state.loading = false;
  }
}

function showInbox() {
  state.selectedId = null;
  elements.readerPanel.classList.add('hidden');
  elements.inboxPanel.classList.remove('hidden');
  renderList();
}

async function openMessage(id) {
  state.selectedId = id;
  elements.inboxPanel.classList.add('hidden');
  elements.readerPanel.classList.remove('hidden');
  elements.detail.innerHTML =
    '<div class="loading-state"><span class="spinner"></span> Opening message…</div>';
  document.querySelector('#status-error').classList.add('hidden');
  document.querySelector('#sidebar').classList.remove('open');

  try {
    const response = await fetch(`/api/v1/message/${encodeURIComponent(id)}`);
    if (!response.ok) throw new Error(`Mailpit returned HTTP ${response.status}`);
    const message = await response.json();
    const current = state.messages.find((item) => item.ID === id);
    const wasUnread = current && !current.Read;
    if (current) current.Read = true;
    updateCounts({
      total: state.total,
      unread: Math.max(0, Number(elements.unread.textContent) - Number(Boolean(wasUnread))),
      start: state.start,
      count: state.messages.length,
    });
    const from = escapeHtml(senderAddress(message));
    const to = escapeHtml(recipientsLabel(message.To));
    const date = escapeHtml(formatDate(message.Date || message.Created));
    const subject = escapeHtml(message.Subject || '(no subject)');
    const body = message.HTML
      ? `<iframe class="message-html" title="Email HTML content" sandbox="" srcdoc="${escapeHtml(message.HTML)}"></iframe>`
      : `<pre class="message-text">${escapeHtml(message.Text || 'This message has no text content.')}</pre>`;
    const attachments = (message.Attachments || [])
      .map(
        (file) => `
      <a class="attachment" href="/api/v1/message/${encodeURIComponent(id)}/part/${encodeURIComponent(file.PartID)}" download="${escapeHtml(file.FileName || 'attachment')}">
        ${icon.file}<span class="attachment-name">${escapeHtml(file.FileName || 'Attachment')}</span>
        <span class="attachment-size">${escapeHtml(formatBytes(file.Size))}</span>
      </a>`,
      )
      .join('');
    elements.detail.innerHTML = `
      <h1 class="message-subject">${subject}</h1>
      <div class="message-meta">
        <span class="sender-avatar" aria-hidden="true">${escapeHtml((message.From?.Name || message.From?.Address || '?').slice(0, 1).toUpperCase())}</span>
        <div class="meta-main"><div class="meta-from">${from}</div><div class="meta-to">to ${to || 'undisclosed recipients'}</div></div>
        <time class="meta-date" datetime="${escapeHtml(message.Date || '')}">${date}</time>
      </div>
      <div class="message-body">${body}</div>
      ${attachments ? `<div class="attachment-list" aria-label="Attachments">${attachments}</div>` : ''}`;
    renderList();
  } catch (error) {
    elements.detail.innerHTML = '';
    elements.statusError.textContent = `Could not open this message. ${error.message}`;
    elements.statusError.classList.remove('hidden');
  }
}

document.querySelectorAll('[data-filter]').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-filter]').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    state.filter = button.dataset.filter;
    state.selectedId = null;
    showInbox();
  });
});
document.querySelector('#refresh-button').addEventListener('click', () => loadMessages(true));
document.querySelector('#reader-refresh').addEventListener('click', () => {
  if (state.selectedId) openMessage(state.selectedId);
});
document.querySelector('#back-button').addEventListener('click', showInbox);
document.querySelector('#older-button').addEventListener('click', () => {
  if (state.start + state.limit < state.total) {
    state.start += state.limit;
    loadMessages(false);
  }
});
elements.search.addEventListener('input', () => {
  state.query = elements.search.value;
  renderList();
});
document.querySelector('#menu-toggle').addEventListener('click', () => {
  document.querySelector('#sidebar').classList.toggle('open');
});
document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    elements.search.focus();
  }
  if (event.key === 'Escape') {
    document.querySelector('#sidebar').classList.remove('open');
    if (!elements.readerPanel.classList.contains('hidden')) showInbox();
  }
});

loadMessages();
window.setInterval(() => loadMessages(true), 15000);
