# Skill: Discord Alert Bot

**Description**: Sends formatted deal alerts to a specific Discord channel using a Bot Token.

## Instructions

1. **Load Environment**: Access `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`, and `DISCORD_CHANNEL_ID` from the `.env` file.
2. **Setup Client**: Use a Node.js script (e.g., in `/tmp/send_discord.js`) using `discord.js`.

3. **Format Alert**:
   - **Title**: 🚨 NEW DEAL FOUND!
   - **Fields**:
     - **Product**: [Product Name]
     - **Price**: $[Current Price] (Target: $[Target Price])
     - **Link**: [URL]
   - **Color**: Green (`#00FF00`) for price drops, Gold (`#FFD700`) for "Limited Time".

4. **Execute**: Run the script to send the message.
5. **Confirm**: Verify the message was sent successfully before terminating the skill.

## Constraints

- Ensure the bot has `SEND_MESSAGES` and `VIEW_CHANNEL` permissions in the target channel.
- Do NOT spam; if multiple deals are found, batch them if possible or space them out by 5 seconds.
