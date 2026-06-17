// Mapear estilos de botones a valores numéricos de Discord
const buttonStyles = {
    primary: 1,
    secondary: 2,
    success: 3,
    danger: 4,
    link: 5
};

// Helper genérico para compilar componentes (soporta .compile, .toJSON y JSON nativo)
function compileComponent(c) {
    if (!c) return c;
    if (typeof c.compile === 'function') return c.compile();
    if (typeof c.toJSON === 'function') return c.toJSON();
    return c;
}

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
            components: this.components.map(compileComponent)
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
            components: this.components.map(compileComponent),
            accessory: compileComponent(this.accessory)
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

class Separator {
    compile() {
        return {
            type: 14 // Separator type
        };
    }
}

class MediaGallery {
    constructor() {
        this.urls = [];
    }

    addMedia(url) {
        this.urls.push(url);
        return this;
    }

    compile() {
        return {
            type: 12, // MediaGallery type
            items: this.urls.map(url => ({ media: { url } }))
        };
    }
}

class ActionRow {
    constructor() {
        this.components = [];
    }

    addComponent(component) {
        this.components.push(component);
        return this;
    }

    compile() {
        return {
            type: 1, // Action Row type
            components: this.components.map(compileComponent)
        };
    }
}

class StringSelect {
    constructor() {
        this.data = {
            type: 3, // String Select type
            options: []
        };
    }

    setCustomId(customId) {
        this.data.custom_id = customId;
        return this;
    }

    setPlaceholder(placeholder) {
        this.data.placeholder = placeholder;
        return this;
    }

    setDisabled(disabled) {
        this.data.disabled = disabled;
        return this;
    }

    addOption(label, value, description = '', isDefault = false) {
        this.data.options.push({
            label,
            value,
            description,
            default: isDefault
        });
        return this;
    }

    addOptions(optionsArray) {
        optionsArray.forEach(opt => {
            this.addOption(opt.label, opt.value, opt.description, opt.default);
        });
        return this;
    }

    compile() {
        return structuredClone(this.data);
    }
}

class ChannelSelect {
    constructor() {
        this.data = {
            type: 8, // Channel Select type
            channel_types: []
        };
    }

    setCustomId(customId) {
        this.data.custom_id = customId;
        return this;
    }

    setPlaceholder(placeholder) {
        this.data.placeholder = placeholder;
        return this;
    }

    setDisabled(disabled) {
        this.data.disabled = disabled;
        return this;
    }

    addChannelType(type) {
        this.data.channel_types.push(type);
        return this;
    }

    setChannelTypes(types) {
        this.data.channel_types = types;
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
    Button,
    Separator,
    MediaGallery,
    ActionRow,
    StringSelect,
    ChannelSelect
};
