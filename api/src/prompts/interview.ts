export interface InterviewPromptInput {
  role: string;
  techStack: string[];
  rubric: Record<string, unknown>;
  questionNumber: number;
  totalQuestions: number;
  conversation: ConversationMessage[];
}

export interface ConversationMessage {
  role: "interviewer" | "candidate";
  content: string;
  questionNumber?: number;
  timestamp: string;
}

export function buildFirstQuestionPrompt(input: {
  role: string;
  techStack: string[];
  rubric: Record<string, unknown>;
  totalQuestions: number;
}): string {
  const techList =
    input.techStack.length > 0
      ? input.techStack.join(", ")
      : "general software engineering";

  const rubricSummary = formatRubricForPrompt(input.rubric);

  return `You are an expert technical interviewer conducting an adaptive interview for a ${input.role} position.

## Context
- **Role**: ${input.role}
- **Tech Stack**: ${techList}
- **Total Questions**: ${input.totalQuestions}
- **Current Question**: 1 of ${input.totalQuestions}

## Evaluation Rubric
${rubricSummary}

## Instructions
Generate the first interview question. This should be a warm-up question that:
- Assesses the candidate's background and experience with the relevant tech stack
- Is open-ended enough to reveal depth of knowledge
- Sets a welcoming but professional tone

Respond with ONLY the interview question text. Do not include numbering, labels, or any meta-commentary.`;
}

export function buildFollowUpQuestionPrompt(input: InterviewPromptInput): string {
  const techList =
    input.techStack.length > 0
      ? input.techStack.join(", ")
      : "general software engineering";

  const rubricSummary = formatRubricForPrompt(input.rubric);
  const conversationHistory = formatConversation(input.conversation);

  return `You are an expert technical interviewer conducting an adaptive interview for a ${input.role} position.

## Context
- **Role**: ${input.role}
- **Tech Stack**: ${techList}
- **Question**: ${input.questionNumber} of ${input.totalQuestions}

## Evaluation Rubric
${rubricSummary}

## Conversation So Far
${conversationHistory}

## Instructions
Based on the candidate's previous answers, generate the next interview question. Consider:
- Areas where the candidate showed strength or weakness
- Topics from the rubric not yet covered
- Progressively increase difficulty as the interview advances
- If the candidate gave a shallow answer, probe deeper on that topic
- If the candidate demonstrated mastery, move to a new rubric area

${input.questionNumber >= input.totalQuestions - 1 ? "This is one of the final questions. Make it a synthesis question that ties together multiple concepts discussed earlier." : ""}

Respond with ONLY the interview question text. Do not include numbering, labels, or any meta-commentary.`;
}

function formatRubricForPrompt(rubric: Record<string, unknown>): string {
  const criteria = rubric.criteria;
  if (!Array.isArray(criteria)) {
    return "No rubric criteria available.";
  }

  return criteria
    .map((c: Record<string, unknown>) => {
      const name = c.name || "Unknown";
      const description = c.description || "";
      const weight = c.weight || 0;
      return `- **${name}** (weight: ${weight}): ${description}`;
    })
    .join("\n");
}

function formatConversation(conversation: ConversationMessage[]): string {
  if (conversation.length === 0) {
    return "No previous conversation.";
  }

  return conversation
    .map((msg) => {
      const speaker = msg.role === "interviewer" ? "Interviewer" : "Candidate";
      return `**${speaker}**: ${msg.content}`;
    })
    .join("\n\n");
}
