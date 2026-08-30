/* ============================================================
   CATME Survey Site
   Stage 1 — screen router + shared state
   Stage 2 — student details form
   Stage 3 — team roster
   Stage 4 — the ten survey items and the rating table
   ============================================================ */

(function () {
  'use strict';

  /* ============================================================
     CONTENT — edit these two lists to change the survey itself
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

  // Delete the NA line if you want a strict 1-7 scale.
  const SCALE = [
    { value: 0, label: 'NA' },
    { value: 1, label: 'Strongly Disagree' },
    { value: 2, label: 'Disagree' },
    { value: 3, label: 'Somewhat Disagree' },
    { value: 4, label: 'Neutral' },
    { value: 5, label: 'Somewhat Agree' },
    { value: 6, label: 'Agree' },
    { value: 7, label: 'Strongly Agree' }
  ];

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
    roster: [],          // [{ name, isSelf }] — teammates first, then the student
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
    // A guard may redirect — e.g. reaching the survey with no roster yet.
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
     STAGE 2 — student details
     ============================================================ */

  const infoForm = $('#info-form');

  const RULES = {
    name(v) {
      if (!v) return 'Please enter your name.';
      if (v.length < 2) return 'That name looks too short.';
      return '';
    },
    studentId(v) {
      if (!v) return 'Please enter your SJTU student ID.';
      if (!/^[A-Za-z0-9]{6,15}$/.test(v)) return 'Use 6–15 letters or digits, no spaces.';
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
     STAGE 3 — team roster
     ============================================================ */

  const rosterForm = $('#roster-form');

  guards.teammates = () => (state.student.teammateCount === null ? 'info' : null);

  onEnter.teammates = function () {
    const count = state.student.teammateCount;

    $('#roster-lede').innerHTML =
      'Name the ' + count + ' other member' + (count === 1 ? '' : 's') +
      ' of <strong>' + esc(state.student.teamId) + '</strong>. ' +
      'You are added to the roster automatically.';

    $('#roster-fields').innerHTML = Array.from({ length: count }, (_, i) => [
      '<div class="field">',
      '  <label for="mate-' + i + '">Team member #' + (i + 1) + '</label>',
      '  <input type="text" id="mate-' + i + '" name="mate-' + i + '" autocomplete="off"',
      '         placeholder="Full name" value="' + esc(state.teammates[i] || '') + '">',
      '  <p class="error" data-error-for="mate-' + i + '"></p>',
      '</div>'
    ].join('\n')).join('');

    $('#roster-self').textContent = state.student.name;
    clearErrors(rosterForm);
  };

  function readRoster() {
    return Array.from({ length: state.student.teammateCount }, (_, i) =>
      (rosterForm.elements['mate-' + i].value || '').trim()
    );
  }

  function validateRoster(names) {
    let firstBad = null;
    const seen = new Map();          // normalised name -> who claimed it first
    seen.set(normalise(state.student.name), 'you');

    names.forEach((name, i) => {
      let message = '';
      if (!name) {
        message = 'Please enter a name.';
      } else if (name.length < 2) {
        message = 'That name looks too short.';
      } else {
        const key = normalise(name);
        if (seen.has(key)) {
          message = seen.get(key) === 'you'
            ? 'This is your own name — you are already on the roster.'
            : 'Same name as team member #' + seen.get(key) + '.';
        } else {
          seen.set(key, i + 1);
        }
      }
      setError(rosterForm, 'mate-' + i, message);
      if (message && firstBad === null) firstBad = i;
    });

    return firstBad;
  }

  rosterForm.addEventListener('submit', ev => {
    ev.preventDefault();
    const names    = readRoster();
    const firstBad = validateRoster(names);

    if (firstBad !== null) {
      rosterForm.elements['mate-' + firstBad].focus();
      return;
    }

    state.teammates = names;

    const nextRoster = names
      .map(name => ({ name: name, isSelf: false }))
      .concat([{ name: state.student.name, isSelf: true }]);

    // Ratings are stored by column index, so a resized roster invalidates them.
    if (nextRoster.length !== state.roster.length) {
      state.ratings = {};
      state.currentItem = 0;
      state.maxItemReached = 0;
    }
    state.roster = nextRoster;

    showScreen('survey');
  });

  rosterForm.addEventListener('input', ev => {
    if (ev.target.name) setError(rosterForm, ev.target.name, '');
  });

  /* ============================================================
     STAGE 4 — survey items and rating table
     ============================================================ */

  const surveyScreen = $('[data-screen="survey"]');
  const itemNav      = $('#item-nav');
  const itemTable    = $('#rating-table');

  guards.survey = () => (state.roster.length === 0 ? 'teammates' : null);

  // ratings[item] is an array with one slot per roster member.
  function ensureRatings(item) {
    if (!Array.isArray(state.ratings[item]) ||
        state.ratings[item].length !== state.roster.length) {
      state.ratings[item] = new Array(state.roster.length).fill(null);
    }
    return state.ratings[item];
  }

  const isRated = item => ensureRatings(item).every(v => v !== null);

  function unratedNames(item) {
    const row = ensureRatings(item);
    return state.roster
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

    const headCells = state.roster.map(m =>
      '<th scope="col" class="' + (m.isSelf ? 'self' : '') + '">' +
      esc(m.name) + (m.isSelf ? '<span class="you-tag">you</span>' : '') +
      '</th>'
    ).join('');

    const bodyRows = SCALE.map(step => {
      const cells = state.roster.map((m, mi) =>
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

    $('#item-prev').textContent = n === 0 ? 'Back to roster' : 'Previous item';
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

  /* ---------- summary (stage 5) ---------- */

  guards.summary = () => (state.roster.length === 0 ? 'teammates' : null);

  /* ============================================================
     BOOT
     ============================================================ */

  // Exposed for console poking while the later stages are built.
  window.CATME = { state: state, showScreen: showScreen, SURVEY_ITEMS: SURVEY_ITEMS, SCALE: SCALE };

  showScreen('welcome');
})();
