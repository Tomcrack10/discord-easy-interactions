const crypto = require('crypto');
const { 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    InteractionCollector,
    ComponentType,
    LabelBuilder,
    StringSelectMenuOptionBuilder,
    TextDisplayBuilder,
    FileUploadBuilder
} = require('discord.js');

class FormBuilder {
    constructor(interactionOrMessage, options = {}) {
        this.ctx = interactionOrMessage;
        this.userId = interactionOrMessage.user ? interactionOrMessage.user.id : interactionOrMessage.author.id;
        this.channel = interactionOrMessage.channel;
        this.steps = [];
        this.answers = new Map();

        // Mensajes personalizables
        this.messages = {
            timeout: options.timeoutMessage || '⌛ El tiempo límite para completar el formulario ha expirado.',
            unauthorized: options.unauthorizedMessage || 'No puedes interactuar en este formulario.',
            modalSubmitted: options.modalSubmittedMessage || 'Respuesta recibida correctamente.'
        };
    }

    // Agregar un paso de pregunta abierta por texto
    addTextStep(questionText, options = {}) {
        this.steps.push({
            type: 'text',
            questionText,
            validate: options.validate || (() => true),
            retryMessage: options.retryMessage || '❌ Respuesta inválida. Intenta de nuevo:'
        });
        return this;
    }

    // Agregar un paso de menú de opciones
    addSelectStep(questionText, choices = [], options = {}) {
        this.steps.push({
            type: 'select',
            questionText,
            choices,
            placeholder: options.placeholder || 'Selecciona una opción...'
        });
        return this;
    }

    // Agregar un paso de modal (para textos largos o múltiples campos)
    addModalStep(questionText, options = {}) {
        this.steps.push({
            type: 'modal',
            questionText,
            title: options.title || 'Formulario',
            buttonLabel: options.buttonLabel || 'Abrir Formulario',
            buttonStyle: options.buttonStyle || ButtonStyle.Primary,
            customId: options.customId || `form_modal_${crypto.randomUUID()}`,
            inputs: options.inputs || [
                {
                    customId: 'input',
                    label: options.inputLabel || 'Escribe tu respuesta:',
                    style: TextInputStyle.Paragraph,
                    required: options.required !== false,
                    placeholder: options.placeholder || ''
                }
            ]
        });
        return this;
    }

    // Iniciar el formulario secuencial
    async start(options = {}) {
        const timeout = options.timeout || 300000; // 5 minutos por defecto
        const startTime = Date.now();

        // Función para validar si queda tiempo
        const checkTimeout = () => {
            if (Date.now() - startTime > timeout) {
                throw new Error('timeout');
            }
        };

        try {
            for (let i = 0; i < this.steps.length; i++) {
                checkTimeout();
                const step = this.steps[i];
                let answerValue = null;

                if (step.type === 'text') {
                    answerValue = await this._runTextStep(step);
                } else if (step.type === 'select') {
                    answerValue = await this._runSelectStep(step);
                } else if (step.type === 'modal') {
                    answerValue = await this._runModalStep(step);
                }

                if (answerValue === null) {
                    return null; // Cancelado o timed out
                }
                this.answers.set(i, answerValue);
            }

            return this.answers;
        } catch (err) {
            if (err.message === 'timeout') {
                try {
                    const payload = this._buildPayload(this.messages.timeout);
                    await this.channel.send(payload);
                } catch (_) {}
            } else {
                console.error('[discord-easy-interactions] Error en FormBuilder:', err);
            }
            return null;
        }
    }

    // Construir el payload de mensaje para soportar texto, embeds, y containers
    _buildPayload(questionText) {
        if (!questionText) return {};
        if (typeof questionText === 'object') {
            if (typeof questionText.toJSON === 'function') {
                return { embeds: [questionText] };
            }
            if (typeof questionText.compile === 'function') {
                const compiled = questionText.compile();
                if (compiled.type === 17) {
                    return { components: [compiled] };
                }
                return compiled;
            }
            return { ...questionText };
        }
        return { content: String(questionText) };
    }

    // Ejecutar un paso de texto
    async _runTextStep(step) {
        const payload = this._buildPayload(step.questionText);
        const promptMsg = await this.channel.send(payload);

        return new Promise((resolve) => {
            const collector = this.channel.createMessageCollector({
                filter: (m) => m.author.id === this.userId,
                time: 60000 // 1 minuto por paso
            });

            collector.on('collect', async (m) => {
                // Ejecutar la validación
                const isValid = await step.validate(m);
                if (isValid) {
                    collector.stop('valid');
                    resolve(m.content);
                } else {
                    const payload = this._buildPayload(step.retryMessage);
                    await this.channel.send(payload);
                }
            });

            collector.on('end', (_, reason) => {
                if (reason !== 'valid') {
                    resolve(null);
                }
            });
        });
    }

    // Ejecutar un paso de menú de selección
    async _runSelectStep(step) {
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`form_select_${crypto.randomUUID()}`)
            .setPlaceholder(step.placeholder)
            .addOptions(step.choices.map(choice => {
                const label = typeof choice === 'string' ? choice : choice.label;
                const value = typeof choice === 'string' ? choice : choice.value;
                return { label, value };
            }));

        const row = new ActionRowBuilder().addComponents(selectMenu);
        const payload = this._buildPayload(step.questionText);
        if (!payload.components) payload.components = [];
        payload.components.push(row);

        const promptMsg = await this.channel.send(payload);

        return new Promise((resolve) => {
            const collector = promptMsg.createMessageComponentCollector({
                componentType: ComponentType.StringSelect,
                time: 60000
            });

            collector.on('collect', async (i) => {
                if (i.user.id !== this.userId) {
                    const payload = this._buildPayload(this.messages.unauthorized);
                    if (typeof payload === 'object') {
                        payload.ephemeral = payload.ephemeral !== false;
                    }
                    return i.reply(payload);
                }
                collector.stop('selected');
                
                // Deshabilitar el componente al finalizar
                try {
                    selectMenu.setDisabled(true);
                    await i.update({ components: [new ActionRowBuilder().addComponents(selectMenu)] });
                } catch (_) {}
                resolve(i.values[0]);
            });

            collector.on('end', (_, reason) => {
                if (reason !== 'selected') {
                    selectMenu.setDisabled(true);
                    promptMsg.edit({ components: [new ActionRowBuilder().addComponents(selectMenu)] }).catch(() => {});
                    resolve(null);
                }
            });
        });
    }

    // Ejecutar un paso de modal (requiere botón intermedio debido a limitaciones de Discord)
    async _runModalStep(step) {
        const customBtnId = `btn_modal_trigger_${crypto.randomUUID()}`;
        const button = new ButtonBuilder()
            .setCustomId(customBtnId)
            .setLabel(step.buttonLabel)
            .setStyle(step.buttonStyle);

        const row = new ActionRowBuilder().addComponents(button);
        const payload = this._buildPayload(step.questionText);
        if (!payload.components) payload.components = [];
        payload.components.push(row);

        const promptMsg = await this.channel.send(payload);

        return new Promise((resolve) => {
            const collector = promptMsg.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 60000
            });

            collector.on('collect', async (i) => {
                if (i.user.id !== this.userId) {
                    const payload = this._buildPayload(this.messages.unauthorized);
                    if (typeof payload === 'object') {
                        payload.ephemeral = payload.ephemeral !== false;
                    }
                    return i.reply(payload);
                }

                // Construir el modal
                const modal = new ModalBuilder()
                    .setCustomId(step.customId)
                    .setTitle(step.title);

                const labels = [];
                const displays = [];

                step.inputs.forEach(inputOpt => {
                    const type = inputOpt.type || 'text';

                    if (type === 'text') {
                        const textInput = new TextInputBuilder()
                            .setCustomId(inputOpt.customId)
                            .setStyle(inputOpt.style || TextInputStyle.Paragraph)
                            .setRequired(inputOpt.required !== false)
                            .setPlaceholder(inputOpt.placeholder || '');
                        
                        if (inputOpt.maxLength) textInput.setMaxLength(inputOpt.maxLength);
                        if (inputOpt.minLength) textInput.setMinLength(inputOpt.minLength);
                        if (inputOpt.value) textInput.setValue(inputOpt.value);

                        const label = new LabelBuilder()
                            .setLabel(inputOpt.label)
                            .setTextInputComponent(textInput);

                        if (inputOpt.description) {
                            label.setDescription(inputOpt.description);
                        }
                        labels.push(label);

                    } else if (type === 'select') {
                        const selectMenu = new StringSelectMenuBuilder()
                            .setCustomId(inputOpt.customId)
                            .setPlaceholder(inputOpt.placeholder || 'Selecciona una opción...')
                            .setRequired(inputOpt.required !== false);

                        if (inputOpt.choices && Array.isArray(inputOpt.choices)) {
                            inputOpt.choices.forEach(choice => {
                                const optLabel = typeof choice === 'string' ? choice : choice.label;
                                const optValue = typeof choice === 'string' ? choice : choice.value;
                                const optDesc = typeof choice === 'object' ? choice.description : undefined;

                                const opt = new StringSelectMenuOptionBuilder()
                                    .setLabel(optLabel)
                                    .setValue(optValue);

                                if (optDesc) opt.setDescription(optDesc);
                                selectMenu.addOptions(opt);
                            });
                        }

                        const label = new LabelBuilder()
                            .setLabel(inputOpt.label)
                            .setStringSelectMenuComponent(selectMenu);

                        if (inputOpt.description) {
                            label.setDescription(inputOpt.description);
                        }
                        labels.push(label);

                    } else if (type === 'textDisplay') {
                        const textDisplay = new TextDisplayBuilder()
                            .setContent(inputOpt.content || '');
                        displays.push(textDisplay);

                    } else if (type === 'fileUpload') {
                        const fileUpload = new FileUploadBuilder()
                            .setCustomId(inputOpt.customId)
                            .setRequired(inputOpt.required !== false);

                        if (inputOpt.minValues !== undefined) fileUpload.setMinValues(inputOpt.minValues);
                        if (inputOpt.maxValues !== undefined) fileUpload.setMaxValues(inputOpt.maxValues);

                        const label = new LabelBuilder()
                            .setLabel(inputOpt.label)
                            .setFileUploadComponent(fileUpload);

                        if (inputOpt.description) {
                            label.setDescription(inputOpt.description);
                        }
                        labels.push(label);
                    }
                });

                if (labels.length > 0) modal.addLabelComponents(...labels);
                if (displays.length > 0) modal.addTextDisplayComponents(...displays);

                // Mostrar el modal
                await i.showModal(modal);

                // Esperar a que lo envíe
                try {
                    const submitted = await i.awaitModalSubmit({
                        filter: (m) => m.customId === step.customId && m.user.id === this.userId,
                        time: 120000 // 2 minutos para escribir
                    });

                    // Agradecer/Confirmar envío del modal de forma efímera
                    try {
                        const payload = this._buildPayload(this.messages.modalSubmitted);
                        if (typeof payload === 'object') {
                            payload.ephemeral = payload.ephemeral !== false;
                        }
                        await submitted.reply(payload);
                    } catch (_) {}

                    collector.stop('submitted');
                    
                    // Deshabilitar botón
                    button.setDisabled(true);
                    try {
                        await promptMsg.edit({ components: [new ActionRowBuilder().addComponents(button)] });
                    } catch (_) {}

                    const values = {};
                    step.inputs.forEach(inputOpt => {
                        const type = inputOpt.type || 'text';
                        if (type === 'text') {
                            values[inputOpt.customId] = submitted.fields.getTextInputValue(inputOpt.customId);
                        } else if (type === 'select') {
                            const vals = submitted.fields.getStringSelectValues(inputOpt.customId);
                            values[inputOpt.customId] = inputOpt.maxValues === 1 || !inputOpt.maxValues ? vals[0] : vals;
                        } else if (type === 'fileUpload') {
                            const files = submitted.fields.getUploadedFiles(inputOpt.customId);
                            values[inputOpt.customId] = inputOpt.maxValues === 1 || !inputOpt.maxValues ? files.first() : files;
                        }
                    });

                    resolve(step.inputs.length === 1 ? values[step.inputs[0].customId] : values);
                } catch (err) {
                    resolve(null);
                }
            });

            collector.on('end', (_, reason) => {
                if (reason !== 'submitted') {
                    button.setDisabled(true);
                    promptMsg.edit({ components: [new ActionRowBuilder().addComponents(button)] }).catch(() => {});
                    resolve(null);
                }
            });
        });
    }
}

module.exports = FormBuilder;
