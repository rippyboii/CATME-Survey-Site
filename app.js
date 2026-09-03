/*
  Peer and self evaluation survey for ENGR1000J.
  Five screens, one state object, and a PDF at the end. Nothing leaves the browser.
*/

(function () {
  'use strict';

  // The item bank from Loughry, Ohland and Moore (2007), Table 2. Each sitting
  // draws its own questions, so pick is how many come from that category.
  const ITEM_BANK = [
    {
      category: 'Contributing to the team’s work',
      pick: 3,
      items: [
        'Did a fair share of the team’s work.',
        'Fulfilled responsibilities to the team.',
        'Came to team meetings prepared.',
        'Completed work in a timely manner.',
        'Did work that was complete and accurate.',
        'Made important contributions to the team’s final product.',
        'Kept trying when faced with difficult situations.',
        'Offered to help teammates when it was appropriate.',
      ]
    },
    {
      category: 'Interacting with teammates',
      pick: 3,
      items: [
        'Communicated effectively.', //1 2 and 3
        'Facilitated effective communication in the team.', //1 2 and 3
        'Exchanged information with teammates in a timely manner.', //1 2 and 3
        'Provided encouragement to other team members.',
        'Expressed enthusiasm about working as a team.',
        'Heard what teammates had to say about issues that affected the team.',
        'Got team input on important matters before going ahead.',
        'Accepted feedback about strengths and weaknesses from teammates.',
        'Used teammates’ feedback to improve performance.',
        'Let other team members help when it was necessary.',
      ]
    },
    {
      category: 'Keeping the team on track',
      pick: 2,
      items: [
        'Stayed aware of fellow team members’ progress.',
        'Assessed whether the team was making progress as expected.',
        'Stayed aware of external factors that influenced team performance.',
        'Provided constructive feedback to others on the team.',
        'Motivated others on the team to do their best.',
        'Made sure that everyone on the team understood important information.',
        'Helped the team to plan and organize its work.',
      ]
    },
    {
      category: 'Expecting quality',
      pick: 1,
      items: [
        'Expected the team to succeed.',
        'Believed that the team could produce high-quality work.', //this
        'Cared that the team produced high-quality work.', // and this
        'Believed that the team should achieve high standards.',
      ]
    },
    {
      category: 'Having relevant knowledge, skills and abilities',
      pick: 1,
      items: [
        'Had the skills and expertise to do excellent work.',
        'Had the skills and abilities that were necessary to do a good job.',
        'Had enough knowledge of teammates’ jobs to be able to fill in if necessary.',
        'Knew how to do the jobs of other team members.',
      ]
    }
  ];

  // Fisher-Yates, on a copy.
  function sample(list, count) {
    const pool = list.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const swap = pool[i]; pool[i] = pool[j]; pool[j] = swap;
    }
    return pool.slice(0, count);
  }

  // This sitting's ten questions, in category order and fixed until reload.
  const SURVEY_ITEMS = ITEM_BANK.reduce((out, section) => out.concat(
    sample(section.items, section.pick)
      .map(text => ({ text: text, category: section.category }))
  ), []);

  const SCALE = [
    { value: 1, label: 'Strongly Disagree' },
    { value: 2, label: 'Disagree' },
    { value: 3, label: 'Somewhat Disagree' },
    { value: 4, label: 'Neutral' },
    { value: 5, label: 'Somewhat Agree' },
    { value: 6, label: 'Agree' },
    { value: 7, label: 'Strongly Agree' }
  ];

  const COPYRIGHT = '\u00a9 ' + new Date().getFullYear() +
    ' Teaching Team, ENGR1000J - Global College, Shanghai Jiao Tong University.' +
    ' All rights reserved.';

  // jsPDF's built-in fonts cannot draw CJK glyphs, so names must stay Latin.
  const PDF_SAFE = /^[\u0020-\u007E\u00A0-\u00FF\u2018\u2019\u201C\u201D\u2013\u2014]*$/;
  const pdfSafe = str => PDF_SAFE.test(str);
  const LATIN_ONLY_MSG =
    'Please write the name in Latin letters (pinyin): the PDF cannot print Chinese characters.';

  // Helpers

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const esc = str => String(str).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  // "  Zhang   Wei " -> "zhang wei", for the duplicate check.
  const normalise = str => str.trim().toLowerCase().replace(/\s+/g, ' ');

  // Everything the survey collects. Each screen reads and writes this.

  const state = {
    student: {
      name: '',
      studentId: '',
      courseCode: 'ENGR1000J',
      teamId: '',
      teammateCount: null
    },
    teammates: [],       // the N names as typed
    members: [],         // [{ name, isSelf }], teammates first, then the student
    ratings: {},         // ratings[item] = one rating per member, null until answered
    currentItem: 0,
    maxItemReached: 0    // how far they got, so earlier items stay reachable
  };

  // Screen router

  const ORDER = ['welcome', 'info', 'teammates', 'survey', 'summary'];

  // guards run before a screen is shown, onEnter hooks after.
  const onEnter = {};
  const guards  = {};

  function showScreen(name) {
    if (!ORDER.includes(name)) {
      console.warn('Unknown screen:', name);
      return;
    }
    // A guard can send them somewhere else, e.g. the survey with no team yet.
    if (guards[name]) {
      const redirect = guards[name]();
      if (redirect) return showScreen(redirect);
    }
    $$('.screen').forEach(el => {
      el.hidden = el.dataset.screen !== name;
    });
    updateProgress(name);
    if (onEnter[name]) onEnter[name]();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function updateProgress(name) {
    const idx = ORDER.indexOf(name);
    $$('#progress li').forEach(li => {
      const at = ORDER.indexOf(li.dataset.step);
      li.classList.toggle('active', at === idx);
      li.classList.toggle('done', at < idx);
    });
  }

  // Any element with data-go="screenName" navigates there.
  document.addEventListener('click', ev => {
    const btn = ev.target.closest('[data-go]');
    if (btn) showScreen(btn.dataset.go);
  });

  // Validation helpers

  function setError(scope, fieldName, message) {
    const input = scope.querySelector('[name="' + fieldName + '"]');
    const slot  = scope.querySelector('[data-error-for="' + fieldName + '"]');
    if (slot) slot.textContent = message || '';
    if (input) input.classList.toggle('invalid', Boolean(message));
  }

  function clearErrors(scope) {
    $$('.error', scope).forEach(el => (el.textContent = ''));
    $$('.invalid', scope).forEach(el => el.classList.remove('invalid'));
  }

  // The Start button waits for the acknowledgement.

  const startCheck = $('#start-check');
  const startBtn   = $('#start-btn');

  startCheck.addEventListener('change', () => {
    startBtn.disabled = !startCheck.checked;
  });

  // Student details

  const infoForm = $('#info-form');

  const RULES = {
    name(v) {
      if (!v) return 'Please enter your name.';
      if (v.length < 2) return 'That name looks too short.';
      if (!pdfSafe(v)) return LATIN_ONLY_MSG;
      return '';
    },
    studentId(v) {
      if (!v) return 'Please enter your SJTU student ID.';
      if (!/^[0-9]+$/.test(v)) return 'Your student ID must be digits only.';
      const n = Number(v);
      if (n <= 500000000000 || n >= 600000000000) {
        return 'Your student ID must be between 500000000001 and 599999999999.';
      }
      return '';
    },
    courseCode(v) {
      if (!v) return 'Please enter the course code.';
      return '';
    },
    teamId(v) {
      if (!v) return 'Please enter your team ID, e.g. Team 02.';
      return '';
    },
    teammateCount(v) {
      if (!v) return 'Please enter a number.';
      const n = Number(v);
      if (!Number.isInteger(n)) return 'Enter a whole number.';
      if (n < 1)  return 'You need at least one teammate to evaluate.';
      if (n > 15) return 'That is more than this form supports (max 15).';
      return '';
    }
  };

  function readInfoForm() {
    const out = {};
    Object.keys(RULES).forEach(key => {
      out[key] = (infoForm.elements[key].value || '').trim();
    });
    return out;
  }

  function validateInfo(values) {
    let firstBad = null;
    Object.keys(RULES).forEach(key => {
      const message = RULES[key](values[key]);
      setError(infoForm, key, message);
      if (message && !firstBad) firstBad = key;
    });
    return firstBad;
  }

  infoForm.addEventListener('submit', ev => {
    ev.preventDefault();
    const values   = readInfoForm();
    const firstBad = validateInfo(values);

    if (firstBad) {
      infoForm.elements[firstBad].focus();
      return;
    }

    const count = Number(values.teammateCount);

    // A different team size invalidates the names already typed.
    if (state.student.teammateCount !== null && state.student.teammateCount !== count) {
      state.teammates.length = count;
    }

    state.student = {
      name: values.name,
      studentId: values.studentId,
      courseCode: values.courseCode,
      teamId: values.teamId,
      teammateCount: count
    };

    showScreen('teammates');
  });

  // Clear the error as soon as they start fixing the field.
  infoForm.addEventListener('input', ev => {
    const key = ev.target.name;
    if (RULES[key]) setError(infoForm, key, '');
  });

  // Coming back to this screen restores what was typed before.
  onEnter.info = function () {
    const s = state.student;
    if (s.name)      infoForm.elements.name.value = s.name;
    if (s.studentId) infoForm.elements.studentId.value = s.studentId;
    if (s.teamId)    infoForm.elements.teamId.value = s.teamId;
    infoForm.elements.courseCode.value = s.courseCode || 'ENGR1000J';
    if (s.teammateCount !== null) {
      infoForm.elements.teammateCount.value = s.teammateCount;
    }
    clearErrors(infoForm);
  };

  // Team members

  const membersForm = $('#members-form');

  guards.teammates = () => (state.student.teammateCount === null ? 'info' : null);

  onEnter.teammates = function () {
    const count = state.student.teammateCount;

    $('#members-lede').innerHTML =
      'Name the ' + count + ' other member' + (count === 1 ? '' : 's') +
      ' of <strong>' + esc(state.student.teamId) + '</strong>. ' +
      'You are added to the list automatically.';

    $('#members-fields').innerHTML = Array.from({ length: count }, (_, i) => [
      '<div class="field">',
      '  <label for="mate-' + i + '">Team member #' + (i + 1) + '</label>',
      '  <input type="text" id="mate-' + i + '" name="mate-' + i + '" autocomplete="off"',
      '         placeholder="Full name" value="' + esc(state.teammates[i] || '') + '">',
      '  <p class="error" data-error-for="mate-' + i + '"></p>',
      '</div>'
    ].join('\n')).join('');

    $('#members-self').textContent = state.student.name;
    clearErrors(membersForm);
  };

  function readmembers() {
    return Array.from({ length: state.student.teammateCount }, (_, i) =>
      (membersForm.elements['mate-' + i].value || '').trim()
    );
  }

  function validatemembers(names) {
    let firstBad = null;
    const seen = new Map();          // normalised name -> who used it first
    seen.set(normalise(state.student.name), 'you');

    names.forEach((name, i) => {
      let message = '';
      if (!name) {
        message = 'Please enter a name.';
      } else if (name.length < 2) {
        message = 'That name looks too short.';
      } else if (!pdfSafe(name)) {
        message = LATIN_ONLY_MSG;
      } else {
        const key = normalise(name);
        if (seen.has(key)) {
          message = seen.get(key) === 'you'
            ? 'This is your own name, you are already on the list.'
            : 'Same name as team member #' + seen.get(key) + '.';
        } else {
          seen.set(key, i + 1);
        }
      }
      setError(membersForm, 'mate-' + i, message);
      if (message && firstBad === null) firstBad = i;
    });

    return firstBad;
  }

  membersForm.addEventListener('submit', ev => {
    ev.preventDefault();
    const names    = readmembers();
    const firstBad = validatemembers(names);

    if (firstBad !== null) {
      membersForm.elements['mate-' + firstBad].focus();
      return;
    }

    state.teammates = names;

    const nextmembers = names
      .map(name => ({ name: name, isSelf: false }))
      .concat([{ name: state.student.name, isSelf: true }]);

    // Ratings are keyed by column, so a resized team invalidates them.
    if (nextmembers.length !== state.members.length) {
      state.ratings = {};
      state.currentItem = 0;
      state.maxItemReached = 0;
    }
    state.members = nextmembers;

    showScreen('survey');
  });

  membersForm.addEventListener('input', ev => {
    if (ev.target.name) setError(membersForm, ev.target.name, '');
  });

  // Survey items and the rating table

  const surveyScreen = $('[data-screen="survey"]');
  const itemNav      = $('#item-nav');
  const itemTable    = $('#rating-table');

  guards.survey = () => (state.members.length === 0 ? 'teammates' : null);

  // One slot per member, created on demand.
  function ensureRatings(item) {
    if (!Array.isArray(state.ratings[item]) ||
        state.ratings[item].length !== state.members.length) {
      state.ratings[item] = new Array(state.members.length).fill(null);
    }
    return state.ratings[item];
  }

  const isRated = item => ensureRatings(item).every(v => v !== null);

  function unratedNames(item) {
    const row = ensureRatings(item);
    return state.members
      .filter((m, i) => row[i] === null)
      .map(m => (m.isSelf ? 'yourself' : m.name));
  }

  // Rendering

  function renderInstruction() {
    $('#survey-instruction').innerHTML =
      'Please evaluate all <strong>' + esc(state.student.teamId) + '</strong> members, ' +
      'including yourself, on the following aspects of team member effectiveness ' +
      'on the scale from 1 (strongly disagree) to 7 (strongly agree).';
  }

  function renderItemNav() {
    itemNav.innerHTML = SURVEY_ITEMS.map((item, i) => {
      const locked = i > state.maxItemReached;
      const cls = ['item-pill',
        i === state.currentItem ? 'active' : '',
        isRated(i) ? 'done' : '',
        locked ? 'locked' : ''
      ].filter(Boolean).join(' ');

      return '<button type="button" class="' + cls + '" data-item="' + i + '"' +
             (locked ? ' disabled' : '') +
             ' title="' + esc(item.text) + '"' +
             ' aria-current="' + (i === state.currentItem) + '">' +
             (i + 1) + '</button>';
    }).join('');
  }

  // Scale down the rows, members across the columns.
  function renderTable() {
    const item = state.currentItem;
    const row  = ensureRatings(item);

    const headCells = state.members.map(m =>
      '<th scope="col" class="' + (m.isSelf ? 'self' : '') + '">' +
      esc(m.name) + (m.isSelf ? '<span class="you-tag">you</span>' : '') +
      '</th>'
    ).join('');

    const bodyRows = SCALE.map(step => {
      const cells = state.members.map((m, mi) =>
        '<td class="' + (m.isSelf ? 'self' : '') + '">' +
        '<label class="cell">' +
        '<input type="radio" name="i' + item + '-m' + mi + '" value="' + step.value + '"' +
        (row[mi] === step.value ? ' checked' : '') +
        ' aria-label="' + esc(m.name) + ': ' + step.value + ' ' + esc(step.label) + '">' +
        '</label></td>'
      ).join('');

      return '<tr>' +
             '<th class="scale-col" scope="row">' +
             '<span class="num">' + step.value + '</span>' +
             '<span class="txt">' + esc(step.label) + '</span>' +
             '</th>' + cells + '</tr>';
    }).join('');

    itemTable.innerHTML =
      '<thead><tr><th class="scale-col" scope="col">Rating</th>' + headCells + '</tr></thead>' +
      '<tbody>' + bodyRows + '</tbody>';
  }

  function renderItem() {
    const n    = state.currentItem;
    const last = SURVEY_ITEMS.length - 1;

    $('#item-heading').textContent =
      'Survey item #' + (n + 1) + ' of ' + SURVEY_ITEMS.length;
    $('#item-text').textContent     = SURVEY_ITEMS[n].text;
    $('#item-category').textContent = SURVEY_ITEMS[n].category;

    $('#item-prev').textContent = n === 0 ? 'Back to team members' : 'Previous item';
    $('#item-next').textContent = n === last ? 'Review answers' : 'Next item';

    renderItemNav();
    renderTable();
    setError(surveyScreen, 'ratings', '');
  }

  onEnter.survey = function () {
    renderInstruction();
    renderItem();
  };

  // Interaction

  itemTable.addEventListener('change', ev => {
    const input = ev.target;
    if (input.type !== 'radio') return;
    const member = Number(input.name.split('-m')[1]);
    ensureRatings(state.currentItem)[member] = Number(input.value);
    setError(surveyScreen, 'ratings', '');
    renderItemNav();
  });

  itemNav.addEventListener('click', ev => {
    const pill = ev.target.closest('[data-item]');
    if (!pill || pill.disabled) return;
    state.currentItem = Number(pill.dataset.item);
    renderItem();
  });

  $('#item-prev').addEventListener('click', () => {
    if (state.currentItem === 0) return showScreen('teammates');
    state.currentItem -= 1;
    renderItem();
  });

  $('#item-next').addEventListener('click', () => {
    const missing = unratedNames(state.currentItem);
    if (missing.length) {
      setError(surveyScreen, 'ratings',
        'Please rate ' + missing.join(', ') + ' before moving on.');
      return;
    }
    if (state.currentItem === SURVEY_ITEMS.length - 1) return showScreen('summary');
    state.currentItem += 1;
    state.maxItemReached = Math.max(state.maxItemReached, state.currentItem);
    renderItem();
  });

  // Summary

  const summaryScreen = $('[data-screen="summary"]');
  const confirmCheck  = $('#confirm-check');
  const downloadBtn   = $('#download-pdf');

  guards.summary = function () {
    if (state.members.length === 0) return 'teammates';
    // Never summarise a half-finished survey.
    const gap = SURVEY_ITEMS.findIndex((_, i) => !isRated(i));
    if (gap !== -1) {
      state.currentItem = gap;
      return 'survey';
    }
    return null;
  };

  function stamp(date) {
    const pad = n => String(n).padStart(2, '0');
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) +
           ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes());
  }

  // One member's ratings across all the items.
  function memberStats(mi) {
    let total = 0;
    SURVEY_ITEMS.forEach((_, item) => { total += ensureRatings(item)[mi]; });
    const mean = total / SURVEY_ITEMS.length;
    return { total: total, mean: mean };
  }

  const allStats = () =>
    state.members.map((m, i) => Object.assign({ member: m }, memberStats(i)));

  const fix2 = n => (n === null ? '-' : n.toFixed(2));

  // Summary rendering

  function detailRows(addressStudent) {
    const s = state.student;
    return [
      ['Name', s.name],
      ['Student ID', s.studentId],
      ['Course', s.courseCode],
      ['Team', s.teamId],
      ['Team size', state.members.length + ' members' +
                    (addressStudent ? ' (including you)' : '')],
      ['Completed', stamp(state.completedAt)]
    ];
  }

  function renderDetails() {
    $('#summary-details').innerHTML = detailRows(true).map(pair =>
      '<div class="detail-pair"><dt>' + esc(pair[0]) + '</dt>' +
      '<dd>' + esc(pair[1]) + '</dd></div>'
    ).join('');
  }

  function renderScoreTable() {
    $('#score-note').textContent =
      'Your average rating for each member across all ' + SURVEY_ITEMS.length + ' items.';

    const rows = allStats().map(st =>
      '<tr class="' + (st.member.isSelf ? 'self' : '') + '">' +
      '<th scope="row">' + esc(st.member.name) +
      (st.member.isSelf ? '<span class="you-tag">you</span>' : '') + '</th>' +
      '<td>' + st.total + '</td>' +
      '<td class="score">' + fix2(st.mean) + ' / 7</td>' +
      '</tr>'
    ).join('');

    $('#score-table').innerHTML =
      '<thead><tr>' +
      '<th scope="col">Member</th>' +
      '<th scope="col">Total</th>' +
      '<th scope="col">Mean (of 7)</th>' +
      '</tr></thead><tbody>' + rows + '</tbody>';
  }

  function renderMatrix() {
    const span = state.members.length + 1;

    const head = '<thead><tr><th class="item-col" scope="col">Survey item</th>' +
      state.members.map(m =>
        '<th scope="col" class="' + (m.isSelf ? 'self' : '') + '">' + esc(m.name) + '</th>'
      ).join('') + '</tr></thead>';

    let seen = '';
    const body = '<tbody>' + SURVEY_ITEMS.map((item, i) => {
      const row = ensureRatings(i);
      let group = '';
      if (item.category !== seen) {
        seen = item.category;
        group = '<tr class="group"><th colspan="' + span + '" scope="colgroup">' +
                esc(item.category) + '</th></tr>';
      }
      return group + '<tr><th class="item-col" scope="row">' +
        '<span class="num">' + (i + 1) + '.</span> ' + esc(item.text) + '</th>' +
        state.members.map((m, mi) =>
          '<td class="' + (m.isSelf ? 'self' : '') + '">' + String(row[mi]) + '</td>'
        ).join('') + '</tr>';
    }).join('') + '</tbody>';

    const stats = allStats();
    const foot = '<tfoot>' +
      '<tr><th class="item-col" scope="row">Total</th>' +
      stats.map(st => '<td class="' + (st.member.isSelf ? 'self' : '') + '">' +
                      st.total + '</td>').join('') + '</tr>' +
      '<tr><th class="item-col" scope="row">Mean (of 7)</th>' +
      stats.map(st => '<td class="' + (st.member.isSelf ? 'self' : '') + '">' +
                      fix2(st.mean) + '</td>').join('') + '</tr>' +
      '</tfoot>';

    $('#matrix-table').innerHTML = head + body + foot;

    $('#scale-legend').textContent =
      'Scale: ' + SCALE.map(s => s.value + ' = ' + s.label).join('  ·  ');
  }

  onEnter.summary = function () {
    state.completedAt = new Date();
    renderDetails();
    renderScoreTable();
    renderMatrix();

    confirmCheck.checked = false;
    downloadBtn.disabled = true;
    $('#pdf-note').hidden = true;
    setError(summaryScreen, 'confirm', '');
  };

  confirmCheck.addEventListener('change', () => {
    downloadBtn.disabled = !confirmCheck.checked;
    setError(summaryScreen, 'confirm', '');
  });

  // PDF export

  // COURSE_TEAM ID_STUDENT ID_STUDENT NAME.pdf
  function pdfFileName() {
    const clean = str => String(str).trim()
      .replace(/[\\/:*?"<>|]/g, '')   // characters Windows rejects
      .replace(/\s+/g, ' ');
    return [state.student.courseCode, state.student.teamId,
            state.student.studentId, state.student.name]
      .map(clean).filter(Boolean).join('_') + '.pdf';
  }

  // An autoTable cell the reader should notice: the student's own line.
  const bold = text => ({ content: text, styles: { fontStyle: 'bold' } });

  // Item rows for the PDF, with a banner row at the top of each category.
  function responseRows() {
    const rows = [];
    let seen = '';
    SURVEY_ITEMS.forEach((item, i) => {
      if (item.category !== seen) {
        seen = item.category;
        rows.push([{
          content: item.category,
          colSpan: state.members.length + 1,
          styles: { fontStyle: 'bold', halign: 'left', fillColor: [240, 241, 243] }
        }]);
      }
      const row = ensureRatings(i);
      rows.push([(i + 1) + '. ' + item.text].concat(state.members.map((m, mi) =>
        m.isSelf ? bold(String(row[mi])) : String(row[mi])
      )));
    });
    return rows;
  }

  function buildPdf() {
    const jsPDF = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDF) throw new Error('jsPDF failed to load - check the vendor/ folder.');

    const doc   = new jsPDF({ unit: 'pt', format: 'a4' });
    const M     = 48;
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    // The banner itself goes on every page, down with the footer.
    const bannerW = 220;
    const bannerH = bannerW / (window.HEADER_RATIO || 5.0562);
    const bannerY = 36;

    // Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('Team Member Effectiveness Survey', pageW / 2, 108, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(110);
    doc.text(state.student.courseCode + ' - peer and self evaluation',
             pageW / 2, 125, { align: 'center' });

    doc.setDrawColor(200);
    doc.line(M, 138, pageW - M, 138);
    doc.setTextColor(30);

    const heading = (text, y) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30);
      doc.text(text, M, y);
      return y + 10;
    };

    // Student details
    let y = heading('Student details', 162);
    doc.autoTable({
      startY: y,
      theme: 'plain',
      margin: { left: M, right: M, top: 96, bottom: 62 },
      styles: { fontSize: 10, cellPadding: 3, textColor: 40 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 110 } },
      body: detailRows(false)
    });

    // Every rating, for reference. The totals live at the foot of this table,
    // so there is no separate averages table.
    y = heading('All responses', doc.lastAutoTable.finalY + 30);
    const memberCols = {};
    state.members.forEach((m, i) => {
      memberCols[i + 1] = { halign: 'center' };
    });
    doc.autoTable({
      startY: y,
      theme: 'grid',
      margin: { left: M, right: M, top: 96, bottom: 62 },
      styles: { fontSize: 8, cellPadding: 4, lineColor: 210, textColor: 40,
                overflow: 'linebreak' },
      headStyles: { fillColor: [240, 241, 243], textColor: 30, fontStyle: 'bold',
                    halign: 'center' },
      columnStyles: Object.assign({ 0: { halign: 'left', cellWidth: 200 } }, memberCols),
      showFoot: 'lastPage',
      rowPageBreak: 'avoid',
      head: [['Survey item'].concat(state.members.map(m => m.name))],
      body: responseRows(),
      foot: [
        ['Total'].concat(allStats().map(st =>
          st.member.isSelf ? bold(String(st.total)) : String(st.total))),
        ['Mean (of 7)'].concat(allStats().map(st =>
          st.member.isSelf ? bold(fix2(st.mean)) : fix2(st.mean)))
      ],
      footStyles: { fillColor: [240, 241, 243], textColor: 30, fontStyle: 'bold',
                    halign: 'center' }
    });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120);
    const legend = 'Scale:  ' + SCALE.map(s => s.value + ' = ' + s.label).join('   ');
    doc.text(doc.splitTextToSize(legend, pageW - M * 2), M, doc.lastAutoTable.finalY + 14);

    // Footer on every page
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);

      if (window.HEADER_PNG) {
        doc.addImage(window.HEADER_PNG, 'PNG',
                     (pageW - bannerW) / 2, bannerY, bannerW, bannerH);
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(140);
      doc.text(state.student.name + ' - ' + state.student.teamId +
               ' - generated ' + stamp(state.completedAt), M, pageH - 38);
      doc.text('Page ' + i + ' of ' + pages, pageW - M, pageH - 38, { align: 'right' });

      doc.setFontSize(7);
      doc.setTextColor(165);
      doc.text(COPYRIGHT, pageW / 2, pageH - 24, { align: 'center' });
    }

    return doc;
  }

  downloadBtn.addEventListener('click', () => {
    if (!confirmCheck.checked) {
      setError(summaryScreen, 'confirm', 'Please tick the confirmation box first.');
      return;
    }
    try {
      const name = pdfFileName();
      buildPdf().save(name);
      const note = $('#pdf-note');
      note.textContent = 'Saved as ' + name + '. Upload that file to Canvas.';
      note.hidden = false;
      setError(summaryScreen, 'confirm', '');
    } catch (err) {
      console.error(err);
      setError(summaryScreen, 'confirm', 'Could not build the PDF: ' + err.message);
    }
  });

  // Handy from the console when something looks wrong.
  window.CATME = {
    state: state, showScreen: showScreen, buildPdf: buildPdf,
    SURVEY_ITEMS: SURVEY_ITEMS, SCALE: SCALE
  };

  $('#year').textContent = new Date().getFullYear();

  showScreen('welcome');
})();
