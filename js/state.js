const State = (() => {
  let currentQuestion = 0;
  const answers = new Array(QUESTIONS.length).fill(null);

  return {
    get currentQuestion() { return currentQuestion; },
    get totalQuestions() { return QUESTIONS.length; },

    getAnswer(qIndex) {
      return answers[qIndex];
    },

    getCurrentAnswer() {
      return answers[currentQuestion] ?? 0;
    },

    setAnswer(answerIndex) {
      answers[currentQuestion] = answerIndex;
    },

    // Sets a specific question's answer regardless of the current question
    // pointer — used by the comic-reveal screen's click-to-cycle dev preview.
    setAnswerAt(qIndex, answerIndex) {
      answers[qIndex] = answerIndex;
    },

    goNext() {
      if (currentQuestion < QUESTIONS.length - 1) {
        currentQuestion++;
        return true;
      }
      return false;
    },

    goPrev() {
      if (currentQuestion > 0) {
        currentQuestion--;
        return true;
      }
      return false;
    },

    reset() {
      currentQuestion = 0;
      answers.fill(null);
    },

    getResults() {
      return answers.map((answerIndex, qIndex) => {
        const idx = answerIndex ?? 0;
        const resultKey = QUESTIONS[qIndex].answers[idx].result;
        return RESULTS_MAP[resultKey] || { label: resultKey, description: "" };
      });
    },
  };
})();
