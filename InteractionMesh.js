const { ActionRowBuilder, ButtonBuilder, StringSelectMenuBuilder, ComponentType } = require('discord.js');

// Clase para crear botones con callbacks
class MeshButton extends ButtonBuilder {
    constructor(data) {
        super(data);
        this.onClickHandler = null;
    }

    // Registrar callback para el clic
    onClick(callback) {
        this.onClickHandler = callback;
        return this;
    }
}

// Clase para crear menus con callbacks
class MeshSelect extends StringSelectMenuBuilder {
    constructor(data) {
        super(data);
        this.onSelectHandler = null;
    }

    // Registrar callback para la selección
    onSelect(callback) {
        this.onSelectHandler = callback;
        return this;
    }
}

class InteractionMesh {
    constructor() {
        this.components = []; // Guardar componentes agregados
    }

    // Añadir un botón a la malla
    addButton(button) {
        this.components.push(button);
        return this;
    }

    // Añadir un menú desplegable
    addSelectMenu(selectMenu) {
        this.components.push(selectMenu);
        return this;
    }

    // Organizar componentes en filas de Discord (ActionRows)
    compile() {
        const rows = [];
        let currentRow = null;

        for (const comp of this.components) {
            // Los menús select ocupan una fila entera obligatoria
            if (comp instanceof StringSelectMenuBuilder) {
                if (currentRow && currentRow.components.length > 0) {
                    rows.push(currentRow);
                    currentRow = null;
                }
                const newRow = new ActionRowBuilder().addComponents(comp);
                rows.push(newRow);
            } else if (comp instanceof ButtonBuilder) {
                // Empaquetar hasta 5 botones en una sola fila
                if (!currentRow) {
                    currentRow = new ActionRowBuilder();
                }
                currentRow.addComponents(comp);

                if (currentRow.components.length === 5) {
                    rows.push(currentRow);
                    currentRow = null;
                }
            }
        }

        if (currentRow && currentRow.components.length > 0) {
            rows.push(currentRow);
        }

        return rows;
    }

    // Activar el colector inteligente para escuchar eventos de los componentes
    listen(messageOrInteraction, options = {}) {
        const timeout = options.timeout || 60000; // Por defecto 1 minuto
        const filter = options.filter || (() => true); // Filtro personalizado opcional
        const useIdle = options.useIdle !== false; // Usar temporizador por inactividad por defecto para evitar timeouts con actividad

        // Obtener el canal o mensaje correcto para el colector
        const target = messageOrInteraction.channel || messageOrInteraction;
        if (!target || typeof target.createMessageComponentCollector !== 'function') {
            throw new Error('[discord-easy-interactions] El objeto proporcionado para escuchar no es válido (requiere canal o mensaje).');
        }

        const collectorOptions = {
            filter: (i) => {
                // Solo capturar interacciones que correspondan a nuestros componentes
                const match = this.components.some(comp => comp.data.custom_id === i.customId);
                return match && filter(i);
            }
        };

        if (useIdle) {
            collectorOptions.idle = timeout;
        } else {
            collectorOptions.time = timeout;
        }

        const collector = target.createMessageComponentCollector(collectorOptions);

        collector.on('collect', async (interaction) => {
            // Buscar qué componente fue presionado
            const comp = this.components.find(c => c.data.custom_id === interaction.customId);
            if (!comp) return;

            try {
                if (comp instanceof MeshButton && comp.onClickHandler) {
                    await comp.onClickHandler(interaction);
                } else if (comp instanceof MeshSelect && comp.onSelectHandler) {
                    await comp.onSelectHandler(interaction, interaction.values);
                }
            } catch (err) {
                console.error(`[discord-easy-interactions] Error ejecutando handler para ${interaction.customId}:`, err);
            }
        });

        // Interceptar eventos 'end' para mapear 'idle' a 'time' y mantener compatibilidad con comandos existentes
        const originalOn = collector.on;
        collector.on = function(event, listener) {
            if (event === 'end') {
                return originalOn.call(this, event, (collected, reason) => {
                    const mappedReason = reason === 'idle' ? 'time' : reason;
                    listener(collected, mappedReason);
                });
            }
            return originalOn.call(this, event, listener);
        };

        const originalOnce = collector.once;
        collector.once = function(event, listener) {
            if (event === 'end') {
                return originalOnce.call(this, event, (collected, reason) => {
                    const mappedReason = reason === 'idle' ? 'time' : reason;
                    listener(collected, mappedReason);
                });
            }
            return originalOnce.call(this, event, listener);
        };

        // Retornar el colector por si el comando quiere escuchar el evento 'end'
        return collector;
    }
}

module.exports = {
    InteractionMesh,
    MeshButton,
    MeshSelect
};
