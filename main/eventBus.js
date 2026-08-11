/**
 * 🚌 CHRONO COGNITIVE OS - EVENT BUS
 * 
 * Internal routing system. Everything in Chrono communicates through events.
 * Prevents tight coupling between modules.
 */

class EventBusCore {
    constructor() {
        this.listeners = {};
    }

    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    emit(event, payload = {}) {
        if (!this.listeners[event]) return;
        this.listeners[event].forEach(callback => callback({ type: event, payload, timestamp: Date.now() }));
    }
}

const EventBus = new EventBusCore();

module.exports = { EventBus };
