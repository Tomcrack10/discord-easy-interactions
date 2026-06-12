// Mapear estilos de botones a valores numéricos de Discord
const buttonStyles = {
    primary: 1,
    secondary: 2,
    success: 3,
    danger: 4,
    link: 5
};

class Container {
    constructor() {
        this.accentColor = 0;
        this.components = [];
    }

    setAccentColor(color) {
        // Aceptar color en formato hex o decimal
        this.accentColor = typeof color === 'string' ? parseInt(color.replace('#', ''), 16) : color;
        return this;
    }

    addComponent(component) {
        this.components.push(component);
        return this;
    }

    compile() {
        return {
            type: 17, // Container type
            accent_color: this.accentColor,
            components: this.components.map(c => typeof c.compile === 'function' ? c.compile() : c)
        };
    }
}

class TextDisplay {
    constructor(content = '') {
        this.content = content;
    }

    setContent(content) {
        this.content = content;
        return this;
    }

    compile() {
        return {
            type: 10, // TextDisplay type
            content: this.content
        };
    }
}

class Section {
    constructor() {
        this.components = [];
        this.accessory = null;
    }

    addComponent(component) {
        this.components.push(component);
        return this;
    }

    setAccessory(accessory) {
        this.accessory = accessory;
        return this;
    }

    compile() {
        return {
            type: 9, // Section type
            components: this.components.map(c => typeof c.compile === 'function' ? c.compile() : c),
            accessory: this.accessory && typeof this.accessory.compile === 'function' ? this.accessory.compile() : this.accessory
        };
    }
}

class Button {
    constructor() {
        this.data = {
            type: 2 // Button component type
        };
    }

    setCustomId(customId) {
        this.data.custom_id = customId;
        return this;
    }

    setLabel(label) {
        this.data.label = label;
        return this;
    }

    setStyle(style) {
        // Si es string, mapearlo a número, sino usar el número directamente
        if (typeof style === 'string') {
            const normalized = style.toLowerCase();
            if (!buttonStyles[normalized]) {
                throw new RangeError(`Estilo de botón inválido: "${style}". Usa uno de estos: ${Object.keys(buttonStyles).join(', ')}`);
            }
            this.data.style = buttonStyles[normalized];
        } else {
            this.data.style = style;
        }
        return this;
    }

    setEmoji(emoji) {
        this.data.emoji = emoji;
        return this;
    }

    setUrl(url) {
        this.data.url = url;
        return this;
    }

    setDisabled(disabled) {
        this.data.disabled = disabled;
        return this;
    }

    compile() {
        return structuredClone(this.data);
    }
}

module.exports = {
    Container,
    TextDisplay,
    Section,
    Button
};
