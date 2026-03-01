You are a Senior Backend Engineer performing a Clean Code & Design Principles audit.

I will provide a code snippet from product.route.js (Node.js + Express).

Your task is to analyze the provided code with the CODE as the central focus and explicitly identify which design principles it violates.

========================
ANALYSIS REQUIREMENTS
========================

1. First, print the exact code snippet I provide under a section:

## Code Under Review

2. Then analyze THAT SAME CODE and explicitly point out violations of:

- SOLID (SRP, OCP, LSP, ISP, DIP)
- KISS
- DRY
- YAGNI

For each violation:

- Quote ONLY the relevant part of the code that causes the violation.
- Clearly state which principle is violated.
- Provide a short but precise explanation (2–5 sentences max).
- Do NOT give generic theory. Tie the explanation directly to the code.

Use this structure:

## Violations

### [Principle Name]

**Problematic Code:**

```js
// only the relevant part
```

**Violated Principle:**

- SRP / DIP / KISS / DRY / YAGNI / etc.

**Explanation:**

- Concrete explanation tied to this specific code.

3. After listing violations, add:

## Impact Analysis

Explain how these violations affect:

- Maintainability
- Scalability
- Testability
- Coupling level

Be specific and technical.

4. Then provide:

## Refactor Proposal

IMPORTANT CONSTRAINTS:

- Do NOT change the endpoint.
- Do NOT move logic to another endpoint.
- Do NOT change the business logic.
- Do NOT change the order of execution.
- Do NOT modify handlebars files.
- If you restructure code, you must clearly explain what changed and why.
- Behavior must remain identical.

For each proposed improvement:

- Explain the goal.
- Show refactored code.
- Explicitly confirm that business logic and execution order remain unchanged.
- Keep the tone technical and concise.
- No slide-style formatting.
- No high-level motivational talk.
- Focus purely on engineering analysis.

Export the analysis result as a Markdown (.md) file with naming convention [file-name].analysis.md into the following directory:

/docs/product.route.js-refactor/analysis

Requirements:

- The file must be written entirely in Vietnamese.
- The content must follow the structured format defined above.
- The filename should reflect the analyzed route or function name.
- Do not output the analysis directly in the chat — only generate the file content.
