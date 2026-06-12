# discord-easy-interactions

A lightweight, fluent, and promise-based wrapper for **Discord.js v14** designed to manage interactive UI flows (buttons, select menus, V2 modals) and sequential wizard forms in a linear, inline fashion. Say goodbye to "callback hell" and fragmented command folders!

## Features

- 🧙 **FormBuilder (Sequential Wizard Forms)**: Gather string selects, free text inputs, file uploads, and V2 modals sequentially using `async/await`.
- 🕸️ **InteractionMesh (Callback-driven Layouts)**: Bind `onClick` and `onSelect` callbacks directly to buttons and menus, bypassing global interaction listeners.
- 🔄 **Activity-aware Listeners**: Utilizes `idle` timeouts instead of absolute limits. Collectors remain active as long as the user keeps interacting.
- 🎴 **Components V2 Support**: Fluent builders for Discord's new modular message components (`Container`, `Section`, `TextDisplay`, `Button`) with color hex-to-decimal conversion and type safety.
- 🛡️ **Production Ready**: Zero third-party runtime dependencies, strict validation of styles, deep-cloned component structures to prevent memory leaks, and native UUID generation.

---

## Installation

```bash
npm install @tomcrack/discord-easy-interactions
```

*Note: `discord.js` (v14.0.0+) is required as a peer dependency.*

---

## Usage Examples

### 1. Sequential Wizard Form (`FormBuilder`)

Perfect for applications, surveys, or setups where steps must run in a specific order.

```javascript
const { FormBuilder } = require('@tomcrack/discord-easy-interactions');
const { TextInputStyle } = require('discord.js');

// Inside your command execute function:
const form = new FormBuilder(interactionOrMessage, {
    timeoutMessage: '⏳ Time limit expired! Please run the command again.',
    unauthorizedMessage: '❌ Only the command executor can interact here.',
    modalSubmittedMessage: '✅ Form received. Thank you!'
})
    .addTextStep('What is your GitHub username?', {
        validate: (m) => m.content.startsWith('https://github.com/'),
        retryMessage: 'Please provide a valid GitHub profile link.'
    })
    .addSelectStep('What is your primary programming language?', [
        'JavaScript', 'TypeScript', 'Python', 'Go'
    ], { placeholder: 'Choose a language...' })
    .addModalStep('Tell us about yourself', {
        title: 'Staff Application Form',
        buttonLabel: 'Open Form',
        inputs: [
            { customId: 'experience', label: 'Work experience:', style: TextInputStyle.Paragraph },
            { customId: 'why', label: 'Why do you want to join?:', style: TextInputStyle.Short }
        ]
    });

const results = await form.start({ timeout: 300000 }); // 5 minutes total

if (results) {
    const githubLink = results.get(0);
    const primaryLang = results.get(1);
    const modalInputs = results.get(2); // Returns an object with input customIds as keys
    
    console.log('Form completed:', { githubLink, primaryLang, modalInputs });
} else {
    console.log('The form expired or was cancelled by the user.');
}
```

---

### 2. Callback-driven Button Layouts (`InteractionMesh`)

Perfect for pagination (e.g. catalog or inventory) and confirmation prompts.

```javascript
const { InteractionMesh, MeshButton } = require('@tomcrack/discord-easy-interactions');
const { ButtonStyle } = require('discord.js');

const mesh = new InteractionMesh();

const confirmBtn = new MeshButton()
    .setCustomId('confirm_action')
    .setLabel('Confirm')
    .setStyle(ButtonStyle.Success)
    .onClick(async (interaction) => {
        await interaction.update({ content: '✅ Action confirmed successfully!', components: [] });
    });

const cancelBtn = new MeshButton()
    .setCustomId('cancel_action')
    .setLabel('Cancel')
    .setStyle(ButtonStyle.Danger)
    .onClick(async (interaction) => {
        await interaction.update({ content: '❌ Action cancelled.', components: [] });
    });

mesh.addButton(confirmBtn).addButton(cancelBtn);

const msg = await message.reply({
    content: 'Are you sure you want to proceed?',
    components: mesh.compile()
});

// Starts listening for clicks. The idle timer resets on every interaction!
mesh.listen(msg, { timeout: 60000 });
```

---

### 3. Modular Message Layouts (Components V2)

Replace old embeds with modular and structured layouts using the new Components V2 standard.

```javascript
const { Container, Section, TextDisplay, Button } = require('@tomcrack/discord-easy-interactions');

const layout = new Container()
    .setAccentColor('#5865F2') // Supports hex string color conversion
    .addComponent(
        new Section()
            .addComponent(
                new TextDisplay('**Welcome!** This message uses Components V2.')
            )
            .setAccessory(
                new Button()
                    .setCustomId('btn_docs')
                    .setLabel('Read Docs')
                    .setStyle('success') // Throws RangeError if style string is invalid
            )
    )
    .compile();

await message.reply({ components: [layout] });
```

---

## Best Practices

1. **Text Step Collectors**: Since `.addTextStep()` relies on a message collector bound to the channel, any message sent by the target user will be consumed as an answer. It is best to run sequential forms in Direct Messages (DMs) or dedicated private channels.
2. **Backwards Compatibility**: The `InteractionMesh.listen()` method uses `idle` timeouts under the hood, but transparently maps `'idle'` events back to `'time'` reasons when the collector ends, so your existing event handlers won't break.

## License

This project is licensed under the ISC License.