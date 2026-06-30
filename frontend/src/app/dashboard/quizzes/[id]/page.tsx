"use client";

import React, { use, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiUrl, authHeaders, getErrorMessage } from "@/lib/api";
import {
  MdChevronLeft,
  MdChevronRight,
  MdCheckCircle,
  MdCancel,
  MdRefresh,
  MdArrowBack,
  MdFeedback,
} from "react-icons/md";
import "./quiz-detail.css";

interface QuizQuestion {
  id: string;
  question_text: string;
  type: string;
  options: string[];
  correct_answer: string;
  explanation: string;
}

interface QuestionCorrection {
  question_id: string;
  student_answer: string;
  correct_answer: string;
  is_correct: boolean;
  explanation: string;

}

interface QuizAttemptResult {
  id: number;
  quiz_id: number;
  score: number;
  total_questions: number;
  corrections: QuestionCorrection[];
  general_feedback: string;
  created_at: string;
}

export default function QuizDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { id: lectureId } = use(params);

  // States
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Soo dejinaya kediska...");
  const [error, setError] = useState<string | null>(null);

  // Active quiz states
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Review states
  const [reviewMode, setReviewMode] = useState(false);
  const [attemptResult, setAttemptResult] = useState<QuizAttemptResult | null>(null);

  // Mode from URL query (mode=review or mode=take)
  const mode = searchParams.get("mode");

  const loadQuizData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // 1. Try to fetch the existing quiz
      const getRes = await fetch(apiUrl(`/api/v1/lectures/${lectureId}/quiz`), {
        headers: authHeaders(),
        cache: "no-store",
      });

      if (getRes.status === 404) {
        // Quiz does not exist, trigger generation
        setLoadingMessage("AI-ga ayaa hadda diyaarinaya kediska casharka. Fadlan sug wax yar (Tani waxay qaadan kartaa ilaa 1 daqiiqo)...");
        const genRes = await fetch(apiUrl(`/api/v1/lectures/${lectureId}/quiz/generate`), {
          method: "POST",
          headers: authHeaders(),
        });

        if (!genRes.ok) {
          const errMsg = await getErrorMessage(genRes, "Waxaa ku guul-dareysanay inaan abuurno kedis cusub.");
          throw new Error(errMsg);
        }

        const quizData = await genRes.json();
        setQuestions(quizData.questions);
      } else if (!getRes.ok) {
        const errMsg = await getErrorMessage(getRes, "Cilad ayaa dhacday intii lagu guda jiray soo dejinta kediska.");
        throw new Error(errMsg);
      } else {
        const quizData = await getRes.json();
        setQuestions(quizData.questions);
      }

      // 2. Check if we should load the latest attempt results
      if (mode === "review") {
        setLoadingMessage("Soo dejinaya natiijadii kuugu dambeysay...");
        const attemptRes = await fetch(apiUrl(`/api/v1/lectures/${lectureId}/quiz/attempts`), {
          headers: authHeaders(),
          cache: "no-store",
        });

        if (attemptRes.ok) {
          const attempts = await attemptRes.json();
          if (attempts && attempts.length > 0) {
            setAttemptResult(attempts[0]); // Load the latest attempt
            setReviewMode(true);
          }
        }
      } else {
        // Clear previous state for a fresh take
        setReviewMode(false);
        setAnswers({});
        setCurrentQuestionIndex(0);
      }
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Waxaa dhacay khalad aan la garanayn.");
    } finally {
      setIsLoading(false);
    }
  }, [lectureId, mode]);

  useEffect(() => {
    loadQuizData();
  }, [loadQuizData]);

  const handleOptionSelect = (questionId: string, optionText: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: optionText,
    }));
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  };

  const handleSubmit = async () => {
    // Check if all questions are answered
    const unansweredCount = questions.filter((q) => !answers[q.id]).length;
    if (unansweredCount > 0) {
      if (!confirm(`Waxaa kuu dhiman ${unansweredCount} su'aalood. Ma rabtaa inaad gudbiso kediska oo la saxo?`)) {
        return;
      }
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const submitRes = await fetch(apiUrl(`/api/v1/lectures/${lectureId}/quiz/submit`), {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ answers }),
      });

      if (!submitRes.ok) {
        const errMsg = await getErrorMessage(submitRes, "Kuma guuleysan inaan gudbino kediska oo la saxo.");
        throw new Error(errMsg);
      }

      const result = await submitRes.json();
      setAttemptResult(result);
      setReviewMode(true);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Cilad ayaa ka dhacday gudbinta jawaabaha.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetake = () => {
    setReviewMode(false);
    setAnswers({});
    setCurrentQuestionIndex(0);
    setAttemptResult(null);
    // update url to clear review mode
    router.replace(`/dashboard/quizzes/${lectureId}?mode=take`);
  };

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", padding: "2rem", textAlign: "center" }}>
        <div className="spinner" style={{ border: "4px solid rgba(0,0,0,0.1)", width: "50px", height: "50px", borderRadius: "50%", borderLeftColor: "var(--primary-color)", animation: "spin 1s linear infinite", marginBottom: "1.5rem" }} />
        <h3 style={{ fontWeight: 600, maxWidth: "550px", lineHeight: "1.5" }}>{loadingMessage}</h3>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "2rem", maxWidth: "600px", margin: "3rem auto" }}>
        <div className="alert alert-danger" style={{ padding: "2rem", borderRadius: "16px", display: "flex", flexDirection: "column", gap: "1rem" }}>
          <h3 style={{ margin: 0, fontWeight: 700 }}>Cilad ayaa dhacday</h3>
          <p style={{ margin: 0, lineHeight: 1.6 }}>{error}</p>
          <div style={{ display: "flex", gap: "10px", marginTop: "0.5rem" }}>
            <button onClick={loadQuizData} className="btn" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <MdRefresh size={18} /> Dib u tijaabi
            </button>
            <button onClick={() => router.push("/dashboard/quizzes")} className="btn btn-secondary-custom">
              Ku laabo Kedisyada
            </button>
          </div>
        </div>
      </div>
    );
  }

  const getScoreColor = (score: number, total: number) => {
    const percent = total ? (score / total) * 100 : 0;
    if (percent >= 80) return "var(--success-color)";
    if (percent >= 50) return "var(--warning-color)";
    return "var(--danger-color)";
  };

  // ----------------------------------------------------
  // REVIEW MODE
  // ----------------------------------------------------
  if (reviewMode && attemptResult) {
    const scoreColor = getScoreColor(attemptResult.score, attemptResult.total_questions);
    const scorePercent = Math.round((attemptResult.score / attemptResult.total_questions) * 100);

    return (
      <div className="fade-in" style={{ maxWidth: "850px", margin: "0 auto", paddingBottom: "4rem" }}>
        <style>{`
          .results-header-card {
            background-color: var(--secondary-bg);
            border: 1px solid var(--border-color);
            border-radius: 20px;
            padding: 2rem;
            box-shadow: var(--card-shadow);
            margin-bottom: 2.5rem;
            display: flex;
            align-items: center;
            gap: 2.5rem;
            flex-wrap: wrap;
          }

          .results-score-circle {
            width: 140px;
            height: 140px;
            border-radius: 50%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: white;
            box-shadow: 0 4px 15px rgba(0,0,0,0.15);
            flex-shrink: 0;
          }

          .results-feedback-box {
            flex: 1;
            min-width: 250px;
          }

          .correction-item {
            background-color: var(--secondary-bg);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            padding: 1.5rem;
            margin-bottom: 1.5rem;
            box-shadow: var(--card-shadow);
          }

          .correction-status-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 1rem;
            gap: 1rem;
          }

          .correction-status-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 0.3rem 0.8rem;
            border-radius: 999px;
            font-size: 0.85rem;
            font-weight: bold;
            color: white;
          }

          .option-correction-row {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 0.75rem 1rem;
            border-radius: 10px;
            border: 1px solid var(--border-color);
            margin-bottom: 0.6rem;
            font-size: 0.95rem;
          }

          .option-correction-row.student-select {
            border-color: var(--danger-color);
            background-color: rgba(239, 68, 68, 0.04);
          }

          .option-correction-row.correct-select {
            border-color: var(--success-color);
            background-color: rgba(16, 185, 129, 0.04);
          }

          .explanation-box {
            margin-top: 1.25rem;
            padding: 1rem;
            border-radius: 10px;
            background-color: var(--bg-color);
            border-left: 4px solid var(--primary-color);
            font-size: 0.92rem;
            line-height: 1.6;
          }
        `}</style>

        <div style={{ marginBottom: "1.5rem" }}>
          <button
            onClick={() => router.push("/dashboard/quizzes")}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontWeight: "600", fontSize: "0.95rem" }}
          >
            <MdArrowBack size={18} /> Ku laabo Kedisyada
          </button>
        </div>

        <div className="results-header-card">
          <div className="results-score-circle" style={{ backgroundColor: scoreColor }}>
            <span style={{ fontSize: "2.2rem", fontWeight: 800 }}>
              {attemptResult.score}/{attemptResult.total_questions}
            </span>
            <span style={{ fontSize: "0.9rem", fontWeight: 600, opacity: 0.9, marginTop: "2px" }}>
              {scorePercent}% Sax ah
            </span>
          </div>

          <div className="results-feedback-box">
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "0.5rem" }}>
              <MdFeedback size={20} style={{ color: "var(--primary-color)" }} />
              <h2 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 700 }}>Qiimaynta Macallinka AI-ga</h2>
            </div>
            <p style={{ margin: 0, lineHeight: 1.6, fontSize: "1.05rem" }}>
              {attemptResult.general_feedback}
            </p>
            <div style={{ marginTop: "1.5rem", display: "flex", gap: "10px" }}>
              <button onClick={handleRetake} className="btn" style={{ padding: "0.6rem 1.2rem", fontSize: "0.9rem", fontWeight: 700 }}>
                Imtixaan kale
              </button>
            </div>
          </div>
        </div>

        <h2 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: "1.5rem" }}>
          Saxista Su&apos;aalaha (Detailed Correction)
        </h2>

        {questions.map((q, index) => {
          const correction = attemptResult.corrections.find((c) => c.question_id === q.id);
          const isCorrect = correction?.is_correct ?? false;

          return (
            <div key={q.id} className="correction-item">
              <div className="correction-status-header">
                <h3 style={{ margin: 0, fontWeight: 700, fontSize: "1.1rem", flex: 1, lineHeight: 1.5 }}>
                  {index + 1}. {q.question_text}
                </h3>
                <span
                  className="correction-status-badge"
                  style={{
                    backgroundColor: isCorrect ? "var(--success-color)" : "var(--danger-color)",
                  }}
                >
                  {isCorrect ? <MdCheckCircle size={16} /> : <MdCancel size={16} />}
                  {isCorrect ? "Sax" : "Khalad"}
                </span>
              </div>

              <div style={{ marginTop: "1rem" }}>
                {q.options.map((opt) => {
                  const isSelected = correction?.student_answer === opt;
                  const isAnswerCorrect = correction?.correct_answer === opt;

                  let styleClass = "";
                  let icon = null;

                  if (isAnswerCorrect) {
                    styleClass = "correct-select";
                    icon = <MdCheckCircle size={18} style={{ color: "var(--success-color)" }} />;
                  } else if (isSelected && !isCorrect) {
                    styleClass = "student-select";
                    icon = <MdCancel size={18} style={{ color: "var(--danger-color)" }} />;
                  }

                  return (
                    <div key={opt} className={`option-correction-row ${styleClass}`}>
                      <div style={{ width: "20px", display: "flex", alignItems: "center" }}>
                        {icon}
                      </div>
                      <span style={{ flex: 1, fontWeight: isSelected || isAnswerCorrect ? "bold" : "normal" }}>{opt}</span>
                      {isSelected && (
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: "bold", textTransform: "uppercase" }}>
                          Jawaabtaada
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {correction?.explanation && (
                <div className="explanation-box">
                  <strong>Sharraxaad:</strong> {correction.explanation}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ----------------------------------------------------
  // QUIZ TAKING MODE
  // ----------------------------------------------------
  const currentQuestion = questions[currentQuestionIndex];
  const answeredCount = Object.keys(answers).length;
  const progressPercent = Math.round((answeredCount / questions.length) * 100);

  return (
    <div className="fade-in" style={{ maxWidth: "750px", margin: "0 auto", paddingBottom: "4rem" }}>
      <style>{`
        .quiz-progress-bar-container {
          background-color: var(--border-color);
          height: 8px;
          border-radius: 999px;
          width: 100%;
          margin-bottom: 2rem;
          overflow: hidden;
          box-shadow: inset 0 1px 3px rgba(0,0,0,0.05);
        }

        .quiz-progress-bar-fill {
          height: 100%;
          background: var(--primary-color);
          border-radius: 999px;
          transition: width 0.3s ease;
        }

        .quiz-question-card {
          background-color: var(--secondary-bg);
          border: 1px solid var(--border-color);
          border-radius: 20px;
          padding: 2.5rem;
          box-shadow: var(--card-shadow);
          margin-bottom: 2rem;
          position: relative;
        }

        .question-number-pill {
          background-color: var(--active-bg);
          color: var(--primary-color);
          padding: 0.3rem 0.8rem;
          border-radius: 999px;
          font-weight: 700;
          font-size: 0.85rem;
          display: inline-block;
          margin-bottom: 1.25rem;
        }

        .question-title-text {
          font-size: 1.35rem;
          font-weight: 700;
          margin: 0 0 2rem 0;
          line-height: 1.5;
        }

        .option-button-card {
          display: flex;
          align-items: center;
          gap: 15px;
          padding: 1.1rem 1.5rem;
          border-radius: 12px;
          border: 2px solid var(--border-color);
          background-color: transparent;
          color: var(--text-color);
          width: 100%;
          text-align: left;
          font-size: 1.05rem;
          font-weight: 500;
          cursor: pointer;
          margin-bottom: 0.9rem;
          transition: all 0.2s ease;
        }

        .option-button-card:hover {
          border-color: var(--primary-color);
          background-color: var(--active-bg);
        }

        .option-button-card.selected {
          border-color: var(--primary-color);
          background-color: var(--active-bg);
          box-shadow: 0 0 0 1px var(--primary-color);
        }

        .option-bullet-circle {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 2px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.8rem;
          font-weight: bold;
          flex-shrink: 0;
          transition: all 0.2s ease;
        }

        .option-button-card.selected .option-bullet-circle {
          border-color: var(--primary-color);
          background-color: var(--primary-color);
          color: white;
        }

        .quiz-nav-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .quiz-nav-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 0.75rem 1.5rem;
          border-radius: 10px;
          font-weight: 700;
          font-size: 0.95rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .quiz-nav-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
      `}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <button
          onClick={() => router.push("/dashboard/quizzes")}
          style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontWeight: "600" }}
        >
          <MdArrowBack size={18} /> Jooji Kediska
        </button>
        <span style={{ fontSize: "0.9rem", color: "var(--text-muted)", fontWeight: "600" }}>
          Fahamka: {answeredCount} ee {questions.length} la xushay
        </span>
      </div>

      <div className="quiz-progress-bar-container">
        <div className="quiz-progress-bar-fill" style={{ width: `${progressPercent}%` }} />
      </div>

      {currentQuestion && (
        <div className="quiz-question-card">
          <span className="question-number-pill">
            Su&apos;aasha {currentQuestionIndex + 1} ee {questions.length}
          </span>
          <h2 className="question-title-text">{currentQuestion.question_text}</h2>

          <div>
            {currentQuestion.options.map((option, index) => {
              const alphabet = ["A", "B", "C", "D", "E"];
              const isSelected = answers[currentQuestion.id] === option;

              return (
                <button
                  key={option}
                  className={`option-button-card ${isSelected ? "selected" : ""}`}
                  onClick={() => handleOptionSelect(currentQuestion.id, option)}
                >
                  <div className="option-bullet-circle">{alphabet[index] || ""}</div>
                  <span>{option}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="quiz-nav-footer">
        <button
          className="quiz-nav-btn btn-secondary-custom"
          onClick={handlePrev}
          disabled={currentQuestionIndex === 0}
        >
          <MdChevronLeft size={20} /> Hore
        </button>

        {currentQuestionIndex === questions.length - 1 ? (
          <button
            className="quiz-nav-btn btn-primary-custom"
            onClick={handleSubmit}
            disabled={isSubmitting}
            style={{ paddingLeft: "2rem", paddingRight: "2rem" }}
          >
            {isSubmitting ? "La saxayaa..." : "Dhammee oo Sax"}
          </button>
        ) : (
          <button
            className="quiz-nav-btn btn-primary-custom"
            onClick={handleNext}
            disabled={!answers[currentQuestion?.id]}
          >
            Ku xiga <MdChevronRight size={20} />
          </button>
        )}
      </div>
    </div>
  );
}
