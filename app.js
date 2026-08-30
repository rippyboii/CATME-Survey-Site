/* ============================================================
   CATME Survey Site
   Stage 1 — screen router + shared state
   Stage 2 — student details form
   ============================================================ */

(function () {
  'use strict';

  /* ---------- tiny helpers ---------- */

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ---------- application state ----------
     Every screen reads from and writes to this single object.
     Later stages fill in `teammates`, `roster` and `ratings`.        */

  const state = {
    student: {
      name: '',
      studentId: '',
      courseCode: 'ENGR1000J',
      teamId: '',
      teammateCount: null
    },
    teammates: [],   // stage 3 — names of the N teammates
    roster: [],      // stage 3 — teammates + the student, in table order
    ratings: {},     // stage 4 — ratings[itemIndex][memberIndex] = 0..7
    currentItem: 0   // stage 4 — which survey item is on screen
  };

  /* ---------- screen router ---------- */

  const ORDER = ['welcome', 'info', 'teammates', 'survey', 'summary'];

  // Optional hook run each time a screen is shown.
  const onEnter = {};

  let current = null;

  function showScreen(name) {
    if (!ORDER.includes(name)) {
      console.warn('Unknown screen:', name);
      return;
    }
    $$('.screen').forEach(el => {
      el.hidden = el.dataset.screen !== name;
    });
    current = name;
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

  function setError(form, fieldName, message) {
    const input = form.elements[fieldName];
    const slot  = $(`[data-error-for="${fieldName}"]`, form);
    if (slot) slot.textContent = message || '';
    if (input) input.classList.toggle('invalid', Boolean(message));
  }

  function clearErrors(form) {
    $$('.error', form).forEach(el => (el.textContent = ''));
    $$('.invalid', form).forEach(el => el.classList.remove('invalid'));
  }

  /* ---------- stage 2 — student details ---------- */

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
    const values  = readInfoForm();
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

  /* ---------- temporary: prove stage 2 captured the data ---------- */

  onEnter.teammates = function () {
    const box = $('#debug-info');
    if (box) box.textContent = JSON.stringify(state.student, null, 2);
  };

  /* ---------- boot ---------- */

  // Exposed for console poking while the later stages are built.
  window.CATME = { state, showScreen };

  showScreen('welcome');
})();
