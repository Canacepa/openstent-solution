import { Controller } from '@hotwired/stimulus';

// Opens a native <dialog> as a modal; a click on the backdrop closes it.
export default class extends Controller {
    static targets = ['dialog'];

    open() { this.dialogTarget.showModal(); }

    close() { this.dialogTarget.close(); }

    backdrop(event) {
        if (event.target === this.dialogTarget) this.close();
    }
}
