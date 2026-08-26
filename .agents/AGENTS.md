# UI Rules for MazariBot

When creating new commands, handling errors, or generating any kind of box UI message, you MUST strictly follow this exact UI template. Do not deviate from this format.

## Box UI Pattern
1. **Top Border**: `╭─〔 ⎔ 𝗧𝗜𝗧𝗟𝗘 𝗛𝗘𝗥𝗘 ⎔ 〕`
   - *CRITICAL*: Do NOT add `─╮` to the right side of the top border.
   - *CRITICAL*: The title text MUST be in bold sans-serif mathematical text (e.g., `𝗔𝗗𝗠𝗜𝗡 𝗢𝗡𝗟𝗬`, `𝗚𝗥𝗢𝗨𝗣 𝗡𝗔𝗠𝗘`). Do not use standard markdown bold (`*TEXT*`) for the title unless you cannot generate the math characters.
2. **Body Lines**: `│ ⚠️ *Body content here*` or `│ ❌ *Error message here*`
   - Start each line with `│ `
   - Use an appropriate emoji.
   - Enclose the body text in standard markdown bold (`* *`).
3. **Bottom Border**: `╰──────────────────────────────`
   - Exactly one `╰` followed by 30 `─` characters.

## Example
```
╭─〔 ⎔ 𝗔𝗗𝗠𝗜𝗡 𝗢𝗡𝗟𝗬 ⎔ 〕
│ ⚠️ *This command is for admins only!*
╰──────────────────────────────
```
