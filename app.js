/* ============================================================
   CATME Survey Site
   Stage 1 - screen router + shared state
   Stage 2 - student details form
   Stage 3 - team members
   Stage 4 - the ten survey items and the rating table
   Stage 5 - summary of the responses
   Stage 6 - PDF export
   ============================================================ */

(function () {
  'use strict';

  /* ============================================================
     CONTENT - edit these two lists to change the survey itself
     ============================================================ */

  // TODO: placeholder wording. Replace with the real ENGR1000J items.
  // Add or remove entries freely; everything else adapts to the count.
  const SURVEY_ITEMS = [
    'Did a fair share of the team’s work.',
    'Completed assigned tasks on time.',
    'Communicated ideas clearly to the rest of the team.',
    'Listened to and considered other members’ viewpoints.',
    'Helped teammates who were struggling with their tasks.',
    'Came to meetings prepared and stayed engaged.',
    'Delivered work that met the team’s quality standards.',
    'Kept the team informed about progress and problems.',
    'Helped the team resolve disagreements constructively.',
    'Had the knowledge and skills needed for their part of the project.'
  ];

  const SCALE = [
    { value: 1, label: 'Strongly Disagree' },
    { value: 2, label: 'Disagree' },
    { value: 3, label: 'Somewhat Disagree' },
    { value: 4, label: 'Neutral' },
    { value: 5, label: 'Somewhat Agree' },
    { value: 6, label: 'Agree' },
    { value: 7, label: 'Strongly Agree' }
  ];

  // Ratings are collected on a 1-7 Likert scale. "Normalised" here means that
  // scale shifted onto 0-6: a mean of 1 becomes 0 and a mean of 7 becomes 6.
  // Swap this one function if the course wants a different definition.
  const NORMALISED_MAX = 6;
  const normaliseScore = mean => mean - 1;

  // jsPDF's built-in fonts cannot draw CJK glyphs, so names must stay Latin.
  const PDF_SAFE = /^[\u0020-\u007E\u00A0-\u00FF\u2018\u2019\u201C\u201D\u2013\u2014]*$/;
  const pdfSafe = str => PDF_SAFE.test(str);
  const LATIN_ONLY_MSG =
    'Please write the name in Latin letters (pinyin): the PDF cannot print Chinese characters.';

  /* ---------- tiny helpers ---------- */

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const esc = str => String(str).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  // "  Zhang   Wei " -> "zhang wei", for duplicate detection only.
  const normalise = str => str.trim().toLowerCase().replace(/\s+/g, ' ');

  /* ============================================================
     APPLICATION STATE
     Every screen reads from and writes to this single object.
     ============================================================ */

  const state = {
    student: {
      name: '',
      studentId: '',
      courseCode: 'ENGR1000J',
      teamId: '',
      teammateCount: null
    },
    teammates: [],       // names of the N teammates, in entry order
    members: [],          // [{ name, isSelf }] - teammates first, then the student
    ratings: {},         // ratings[itemIndex] = [ratingPerMember]  (null = unanswered)
    currentItem: 0,      // which survey item is on screen
    maxItemReached: 0    // furthest item unlocked, so earlier ones stay revisitable
  };

  /* ============================================================
     SCREEN ROUTER
     ============================================================ */

  const ORDER = ['welcome', 'info', 'teammates', 'survey', 'summary'];

  // Optional hooks: guards run before a screen is shown, onEnter after.
  const onEnter = {};
  const guards  = {};

  function showScreen(name) {
    if (!ORDER.includes(name)) {
      console.warn('Unknown screen:', name);
      return;
    }
    // A guard may redirect - e.g. reaching the survey with no members yet.
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

  /* ---------- validation helpers ---------- */

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

  /* ============================================================
     STAGE 1b - the student must acknowledge the instructions
     ============================================================ */

  const startCheck = $('#start-check');
  const startBtn   = $('#start-btn');

  startCheck.addEventListener('change', () => {
    startBtn.disabled = !startCheck.checked;
  });

  /* ============================================================
     STAGE 2 - student details
     ============================================================ */

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

    // Changing the team size invalidates any names already collected.
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

  // Clear a field's error as soon as the student fixes it.
  infoForm.addEventListener('input', ev => {
    const key = ev.target.name;
    if (RULES[key]) setError(infoForm, key, '');
  });

  // Re-entering the screen restores whatever was entered before.
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

  /* ============================================================
     STAGE 3 - team members
     ============================================================ */

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
    const seen = new Map();          // normalised name -> who claimed it first
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

    // Ratings are stored by column index, so a resized members invalidates them.
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

  /* ============================================================
     STAGE 4 - survey items and rating table
     ============================================================ */

  const surveyScreen = $('[data-screen="survey"]');
  const itemNav      = $('#item-nav');
  const itemTable    = $('#rating-table');

  guards.survey = () => (state.members.length === 0 ? 'teammates' : null);

  // ratings[item] is an array with one slot per members member.
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

  /* ---------- rendering ---------- */

  function renderInstruction() {
    $('#survey-instruction').innerHTML =
      'Please evaluate all <strong>' + esc(state.student.teamId) + '</strong> members, ' +
      'including yourself, on the following aspects of team member effectiveness ' +
      'on the scale from 1 (strongly disagree) to 7 (strongly agree).';
  }

  function renderItemNav() {
    itemNav.innerHTML = SURVEY_ITEMS.map((text, i) => {
      const locked = i > state.maxItemReached;
      const cls = ['item-pill',
        i === state.currentItem ? 'active' : '',
        isRated(i) ? 'done' : '',
        locked ? 'locked' : ''
      ].filter(Boolean).join(' ');

      return '<button type="button" class="' + cls + '" data-item="' + i + '"' +
             (locked ? ' disabled' : '') +
             ' title="' + esc(text) + '"' +
             ' aria-current="' + (i === state.currentItem) + '">' +
             (i + 1) + '</button>';
    }).join('');
  }

  // Rows are the rating scale; columns are the team members.
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
    $('#item-text').textContent = SURVEY_ITEMS[n];

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

  /* ---------- interaction ---------- */

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

  /* ============================================================
     STAGE 5 - summary
     ============================================================ */

  const summaryScreen = $('[data-screen="summary"]');
  const confirmCheck  = $('#confirm-check');
  const downloadBtn   = $('#download-pdf');

  guards.summary = function () {
    if (state.members.length === 0) return 'teammates';
    // Defensive: never summarise a half-finished survey.
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

  // One member's ratings across every survey item.
  function memberStats(mi) {
    let total = 0;
    SURVEY_ITEMS.forEach((_, item) => { total += ensureRatings(item)[mi]; });
    const mean = total / SURVEY_ITEMS.length;
    return { total: total, mean: mean, score: normaliseScore(mean) };
  }

  const allStats = () =>
    state.members.map((m, i) => Object.assign({ member: m }, memberStats(i)));

  const fix2 = n => (n === null ? '-' : n.toFixed(2));

  /* ---------- share of work ---------- */

  // A fixed categorical order, assigned by position and never cycled.
  const SLICE_COLOURS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100',
                         '#e87ba4', '#008300', '#4a3aa7', '#e34948'];
  const OTHER_COLOUR = '#9aa1ab';
  const SURFACE = '#ffffff';

  const pct = share => (share * 100).toFixed(1) + '%';

  // Share of work = one member's rating total over the whole team's total.
  // One entry per member, in roster order: what the tables need.
  function memberShares() {
    const stats = allStats();
    const grand = stats.reduce((sum, st) => sum + st.total, 0);
    return stats.map(st => ({
      name: st.member.name,
      isSelf: st.member.isSelf,
      share: grand ? st.total / grand : 0
    }));
  }

  // The pie's slices. Same numbers, but a team bigger than the palette folds
  // its tail into one slice, so this no longer lines up with the roster.
  function workShares() {
    const shares = memberShares();

    if (shares.length <= SLICE_COLOURS.length) {
      return shares.map((s, i) => Object.assign(s, { colour: SLICE_COLOURS[i] }));
    }
    // Past the palette the tail folds into one slice rather than repeating a hue.
    const kept = shares.slice(0, SLICE_COLOURS.length - 1)
      .map((s, i) => Object.assign(s, { colour: SLICE_COLOURS[i] }));
    const rest = shares.slice(SLICE_COLOURS.length - 1);
    kept.push({
      name: 'Other (' + rest.length + ' members)',
      isSelf: false,
      share: rest.reduce((sum, s) => sum + s.share, 0),
      colour: OTHER_COLOUR
    });
    return kept;
  }

  function slicePath(cx, cy, r, from, to) {
    const x1 = cx + r * Math.cos(from), y1 = cy + r * Math.sin(from);
    const x2 = cx + r * Math.cos(to),   y2 = cy + r * Math.sin(to);
    const wide = to - from > Math.PI ? 1 : 0;
    return 'M ' + cx + ' ' + cy + ' L ' + x1.toFixed(2) + ' ' + y1.toFixed(2) +
           ' A ' + r + ' ' + r + ' 0 ' + wide + ' 1 ' + x2.toFixed(2) + ' ' + y2.toFixed(2) + ' Z';
  }

  function renderPie() {
    const slices = workShares();
    const size = 240, r = 112, cx = size / 2, cy = size / 2;

    let angle = -Math.PI / 2;
    const paths = slices.map(s => {
      const sweep = s.share * Math.PI * 2;
      const d = slicePath(cx, cy, r, angle, angle + sweep);
      angle += sweep;
      return '<path d="' + d + '" fill="' + s.colour + '" stroke="' + SURFACE +
             '" stroke-width="2"><title>' + esc(s.name) + ': ' + pct(s.share) +
             '</title></path>';
    }).join('');

    $('#pie-figure').innerHTML =
      '<svg viewBox="0 0 ' + size + ' ' + size + '" role="img" ' +
      'aria-label="Share of the team workload by member">' + paths + '</svg>';

    $('#pie-legend').innerHTML = slices.map(s =>
      '<li><span class="swatch" style="background:' + s.colour + '"></span>' +
      '<span class="who">' + esc(s.name) + (s.isSelf ? ' (you)' : '') + '</span>' +
      '<span class="pct">' + pct(s.share) + '</span></li>'
    ).join('');

    $('#pie-note').textContent =
      'Each member\'s rating total as a share of the team total, from your answers alone.';
  }

  /* ---------- summary rendering ---------- */

  function detailRows() {
    const s = state.student;
    return [
      ['Name', s.name],
      ['Student ID', s.studentId],
      ['Course', s.courseCode],
      ['Team', s.teamId],
      ['Team size', state.members.length + ' members (including you)'],
      ['Completed', stamp(state.completedAt)]
    ];
  }

  function renderDetails() {
    $('#summary-details').innerHTML = detailRows().map(pair =>
      '<div class="detail-pair"><dt>' + esc(pair[0]) + '</dt>' +
      '<dd>' + esc(pair[1]) + '</dd></div>'
    ).join('');
  }

  function renderScoreTable() {
    $('#score-note').textContent =
      'Mean of your 1 to 7 ratings, shifted onto a 0 to ' + NORMALISED_MAX + ' scale.';

    const shares = memberShares();

    const rows = allStats().map((st, i) =>
      '<tr class="' + (st.member.isSelf ? 'self' : '') + '">' +
      '<th scope="row">' + esc(st.member.name) +
      (st.member.isSelf ? '<span class="you-tag">you</span>' : '') + '</th>' +
      '<td>' + fix2(st.mean) + '</td>' +
      '<td class="score">' + fix2(st.score) + ' / ' + NORMALISED_MAX + '</td>' +
      '<td>' + pct(shares[i].share) + '</td>' +
      '</tr>'
    ).join('');

    $('#score-table').innerHTML =
      '<thead><tr>' +
      '<th scope="col">Member</th><th scope="col">Mean (of 7)</th>' +
      '<th scope="col">Normalised (of ' + NORMALISED_MAX + ')</th>' +
      '<th scope="col">Share of work</th>' +
      '</tr></thead><tbody>' + rows + '</tbody>';
  }

  function renderMatrix() {
    const head = '<thead><tr><th class="item-col" scope="col">Survey item</th>' +
      state.members.map(m =>
        '<th scope="col" class="' + (m.isSelf ? 'self' : '') + '">' + esc(m.name) + '</th>'
      ).join('') + '</tr></thead>';

    const body = '<tbody>' + SURVEY_ITEMS.map((text, i) => {
      const row = ensureRatings(i);
      return '<tr><th class="item-col" scope="row">' +
        '<span class="num">' + (i + 1) + '.</span> ' + esc(text) + '</th>' +
        state.members.map((m, mi) =>
          '<td class="' + (m.isSelf ? 'self' : '') + '">' + String(row[mi]) + '</td>'
        ).join('') + '</tr>';
    }).join('') + '</tbody>';

    $('#matrix-table').innerHTML = head + body;

    $('#scale-legend').textContent =
      'Scale: ' + SCALE.map(s => s.value + ' = ' + s.label).join('  ·  ');
  }

  onEnter.summary = function () {
    state.completedAt = new Date();
    renderDetails();
    renderScoreTable();
    renderPie();
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

  /* ============================================================
     STAGE 6 - PDF export
     ============================================================ */

  // COURSE_TEAM ID_STUDENT ID_STUDENT NAME.pdf
  function pdfFileName() {
    const clean = str => String(str).trim()
      .replace(/[\\/:*?"<>|]/g, '')   // characters Windows will not accept
      .replace(/\s+/g, ' ');
    return [state.student.courseCode, state.student.teamId,
            state.student.studentId, state.student.name]
      .map(clean).filter(Boolean).join('_') + '.pdf';
  }

  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  // The same pie the summary shows, drawn on a canvas so jsPDF can embed it.
  function pieImage(slices, px) {
    const scale  = 3;                       // oversample so print stays crisp
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = px * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.fillStyle = SURFACE;
    ctx.fillRect(0, 0, px, px);

    const cx = px / 2, cy = px / 2, r = px / 2 - 2;
    let angle = -Math.PI / 2;
    slices.forEach(s => {
      const sweep = s.share * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, angle, angle + sweep);
      ctx.closePath();
      ctx.fillStyle = s.colour;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = SURFACE;
      ctx.stroke();
      angle += sweep;
    });
    return canvas.toDataURL('image/png');
  }

  function buildPdf() {
    const jsPDF = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDF) throw new Error('jsPDF failed to load - check the vendor/ folder.');

    const doc   = new jsPDF({ unit: 'pt', format: 'a4' });
    const M     = 48;
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    /* --- header --- */
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('Team Member Effectiveness Survey', M, 58);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(110);
    doc.text('Peer & self evaluation - ' + state.student.courseCode, M, 75);

    doc.setDrawColor(200);
    doc.line(M, 86, pageW - M, 86);
    doc.setTextColor(30);

    const heading = (text, y) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30);
      doc.text(text, M, y);
      return y + 10;
    };

    /* --- student details --- */
    let y = heading('Student details', 110);
    doc.autoTable({
      startY: y,
      theme: 'plain',
      margin: { left: M, right: M },
      styles: { fontSize: 10, cellPadding: 3, textColor: 40 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 110 } },
      body: detailRows()
    });

    /* --- normalised scores --- */
    const pdfShares = memberShares();
    y = heading('Normalised scores', doc.lastAutoTable.finalY + 26);
    doc.autoTable({
      startY: y,
      theme: 'grid',
      margin: { left: M, right: M },
      styles: { fontSize: 9, cellPadding: 5, lineColor: 210, textColor: 40 },
      headStyles: { fillColor: [240, 241, 243], textColor: 30, fontStyle: 'bold' },
      columnStyles: {
        0: { halign: 'left' }, 1: { halign: 'center' },
        2: { halign: 'center', fontStyle: 'bold' }, 3: { halign: 'center' }
      },
      head: [['Member', 'Mean (of 7)', 'Normalised (of ' + NORMALISED_MAX + ')',
              'Share of work']],
      body: allStats().map((st, i) => [
        st.member.name + (st.member.isSelf ? '  (you)' : ''),
        fix2(st.mean),
        fix2(st.score) + ' / ' + NORMALISED_MAX,
        pct(pdfShares[i].share)
      ])
    });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(' ',
             M, doc.lastAutoTable.finalY + 14);

    /* --- share of work --- */
    y = heading('Share of work', doc.lastAutoTable.finalY + 38);
    const slices  = workShares();
    const pieSize = 132;
    const legendH = slices.length * 16 + 8;

    if (y + Math.max(pieSize, legendH) > pageH - 70) {   // keep it on one page
      doc.addPage();
      y = heading('Share of work', 70);
    }

    doc.addImage(pieImage(slices, 132), 'PNG', M, y + 6, pieSize, pieSize);

    let ly = y + 22;
    const legendX = M + pieSize + 28;
    slices.forEach(s => {
      const rgb = hexToRgb(s.colour);
      doc.setFillColor(rgb[0], rgb[1], rgb[2]);
      doc.rect(legendX, ly - 7, 9, 9, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(40);
      doc.text(s.name + (s.isSelf ? ' (you)' : ''), legendX + 16, ly);
      doc.text(pct(s.share), pageW - M, ly, { align: 'right' });
      ly += 16;
    });

    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(" ",
             M, y + pieSize + 22);

    /* --- every rating, for reference --- */
    y = heading('All responses', Math.max(y + pieSize + 22, ly) + 26);
    const memberCols = {};
    state.members.forEach((m, i) => {
      memberCols[i + 1] = { halign: 'center' };
    });
    doc.autoTable({
      startY: y,
      theme: 'grid',
      margin: { left: M, right: M },
      styles: { fontSize: 8, cellPadding: 4, lineColor: 210, textColor: 40,
                overflow: 'linebreak' },
      headStyles: { fillColor: [240, 241, 243], textColor: 30, fontStyle: 'bold',
                    halign: 'center' },
      columnStyles: Object.assign({ 0: { halign: 'left', cellWidth: 200 } }, memberCols),
      head: [['Survey item'].concat(state.members.map(m =>
        m.name + (m.isSelf ? ' (you)' : '')))],
      body: SURVEY_ITEMS.map((text, i) => {
        const row = ensureRatings(i);
        return [(i + 1) + '. ' + text].concat(state.members.map((m, mi) => String(row[mi])));
      })
    });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120);
    const legend = 'Scale:  ' + SCALE.map(s => s.value + ' = ' + s.label).join('   ');
    doc.text(doc.splitTextToSize(legend, pageW - M * 2), M, doc.lastAutoTable.finalY + 14);

    /* --- footer on every page --- */
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(140);
      doc.text(state.student.name + ' - ' + state.student.teamId +
               ' - generated ' + stamp(state.completedAt), M, pageH - 26);
      doc.text('Page ' + i + ' of ' + pages, pageW - M, pageH - 26, { align: 'right' });
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

  /* ============================================================
     BOOT
     ============================================================ */

  // Exposed for console poking while the later stages are built.
  window.CATME = {
    state: state, showScreen: showScreen, buildPdf: buildPdf,
    SURVEY_ITEMS: SURVEY_ITEMS, SCALE: SCALE
  };

  showScreen('welcome');
})();
