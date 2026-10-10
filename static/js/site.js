(function () {
  'use strict';

  document.documentElement.classList.add('js');

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function formatValue(value, digits) {
    if (value === null || value === undefined) return '–';
    return typeof value === 'number' ? value.toFixed(digits) : String(value);
  }

  // Best value per column among the rows of one group marked `rank`.
  function bestByColumn(group, columnCount) {
    const best = new Array(columnCount).fill(null);
    if (!group.rank) return best;
    group.rows.forEach((row) => {
      row.values.forEach((value, index) => {
        if (typeof value === 'number' && (best[index] === null || value > best[index])) {
          best[index] = value;
        }
      });
    });
    // A column where every row ties has no winner to mark.
    return best.map((value, index) => {
      if (value === null || value === 0) return null;
      const tied = group.rows.every((row) => row.values[index] === value);
      return tied && group.rows.length > 1 ? null : value;
    });
  }

  function renderTable(shell, config, tabIndex, viewKey) {
    const tab = config.tabs[tabIndex];
    const view = tab.views ? tab.views[viewKey] : tab;
    const columns = tab.columns;
    const digits = tab.digits === undefined ? 1 : tab.digits;
    const table = shell.querySelector('.results-table');
    table.replaceChildren();

    const head = el('thead');
    const headRow = el('tr');
    headRow.appendChild(el('th', '', tab.rowHeader || 'Method'));
    columns.forEach((name, index) => {
      const th = el('th', index === columns.length - 1 && tab.lastIsAverage ? 'col-avg' : '', name);
      th.scope = 'col';
      headRow.appendChild(th);
    });
    head.appendChild(headRow);
    table.appendChild(head);

    const body = el('tbody');
    view.groups.forEach((group) => {
      const best = bestByColumn(group, columns.length);
      if (group.label) {
        const row = el('tr', 'group-row');
        const cell = el('td', '', group.label);
        cell.colSpan = columns.length + 1;
        row.appendChild(cell);
        body.appendChild(row);
      }
      group.rows.forEach((item) => {
        const row = el('tr', item.ours ? 'ours' : '');
        row.appendChild(el('td', '', item.name));
        item.values.forEach((value, index) => {
          const classes = [];
          if (index === columns.length - 1 && tab.lastIsAverage) classes.push('col-avg');
          if (group.rank && best[index] !== null && value === best[index]) classes.push('best');
          if (value === null) classes.push('muted-cell');
          row.appendChild(el('td', classes.join(' '), formatValue(value, digits)));
        });
        body.appendChild(row);
      });
    });
    table.appendChild(body);

    const note = shell.querySelector('.table-note');
    if (note) note.textContent = (view.note || tab.note || '');
    const summary = shell.querySelector('.table-summary');
    if (summary) {
      summary.replaceChildren();
      (view.summary || tab.summary || []).forEach(([value, label]) => {
        const chip = el('div', 'summary-chip');
        chip.appendChild(el('strong', '', value));
        chip.appendChild(el('span', '', label));
        summary.appendChild(chip);
      });
      summary.hidden = summary.children.length === 0;
    }
    const caption = shell.querySelector('.table-caption');
    if (caption) caption.textContent = view.caption || tab.caption || '';
  }

  function setupTables() {
    const page = window.PAGE || {};
    document.querySelectorAll('.table-shell[data-table]').forEach((shell) => {
      const config = (page.tables || {})[shell.dataset.table];
      if (!config) return;
      const state = { tab: 0, view: config.defaultView || null };
      const tabList = shell.querySelector('.tabs[data-role="tabs"]');
      const viewList = shell.querySelector('.tabs[data-role="views"]');

      function refresh() {
        const tab = config.tabs[state.tab];
        if (viewList) viewList.hidden = !tab.views;
        renderTable(shell, config, state.tab, state.view);
      }

      function buildButtons(container, items, isActive, onPick) {
        container.replaceChildren();
        items.forEach((item, index) => {
          const button = el('button', 'tab' + (isActive(item, index) ? ' is-active' : ''), item.label);
          button.type = 'button';
          button.setAttribute('role', 'tab');
          button.setAttribute('aria-selected', String(isActive(item, index)));
          button.addEventListener('click', () => {
            onPick(item, index);
            container.querySelectorAll('.tab').forEach((other) => {
              const active = other === button;
              other.classList.toggle('is-active', active);
              other.setAttribute('aria-selected', String(active));
            });
            refresh();
          });
          container.appendChild(button);
        });
      }

      buildButtons(tabList, config.tabs, (_, index) => index === state.tab, (_, index) => { state.tab = index; });
      if (viewList && config.views) {
        buildButtons(viewList, config.views, (item) => item.key === state.view, (item) => { state.view = item.key; });
      }
      refresh();
    });
  }

  function setupNavigation() {
    const toggle = document.querySelector('.nav-toggle');
    const links = document.querySelector('.nav-links');
    if (!toggle || !links) return;
    toggle.addEventListener('click', () => {
      const open = links.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    links.addEventListener('click', (event) => {
      if (event.target.closest('a')) {
        links.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  function setupCopy() {
    const button = document.querySelector('#copy-bibtex');
    const source = document.querySelector('#bibtex-source');
    if (!button || !source) return;
    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(source.textContent);
        button.textContent = 'Copied';
      } catch (error) {
        button.textContent = 'Select and copy';
      }
      window.setTimeout(() => { button.textContent = 'Copy'; }, 1800);
    });
  }

  function setupVisibility() {
    const root = document.querySelector('.visibility');
    if (!root) return;
    const note = root.querySelector('.vis-note');
    const rows = root.querySelectorAll('.vis-row');
    const buttons = root.querySelectorAll('.vis-controls .tab');
    function pick(name) {
      rows.forEach((row) => row.classList.toggle('is-active', name === 'all' || row.dataset.method === name));
      buttons.forEach((button) => {
        const active = button.dataset.method === name;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
      });
      const active = root.querySelector('.vis-controls .tab[data-method="' + name + '"]');
      note.textContent = active ? active.dataset.note : '';
    }
    buttons.forEach((button) => button.addEventListener('click', () => pick(button.dataset.method)));
    pick('ours');
  }

  function setupReveal() {
    const items = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
      items.forEach((item) => item.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver((entries, instance) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          instance.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    items.forEach((item) => observer.observe(item));
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupNavigation();
    setupTables();
    setupCopy();
    setupVisibility();
    setupReveal();
  });
})();
