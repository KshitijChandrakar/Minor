// Sidebar Manager
class SidebarManager {
    constructor() {
        console.log("HI");
        this.sidebarContainer = document.querySelector(".sidebar-container");
        this.toggleButtons = document.querySelectorAll(".sidebar-toggle-btn");
        this.sidebars = document.querySelectorAll(".sidebar");
        this.currentSidebar = "files"; // Default sidebar
        this.init();
    }

    init() {
        // Setup toggle buttons
        this.toggleButtons.forEach((btn) => {
            btn.addEventListener("click", (e) => {
                const sidebarId = btn.dataset.sidebar;
                this.toggleSidebar(sidebarId);
            });
        });
    }

    toggleSidebar(sidebarId) {
        console.log(sidebarId, "Pressed");
        // If clicking the same sidebar that's currently visible
        if (this.currentSidebar === sidebarId && !this.isHidden()) {
            this.hide();
        } else {
            this.show(sidebarId);
        }
    }

    show(sidebarId) {
        // Update active button
        this.toggleButtons.forEach((btn) => {
            if (btn.dataset.sidebar === sidebarId) {
                btn.classList.add("active");
            } else {
                btn.classList.remove("active");
            }
        });

        // Update active sidebar - only the active one should be visible
        this.sidebars.forEach((sidebar) => {
            if (sidebar.id === `${sidebarId}-sidebar`) {
                sidebar.classList.remove("hidden");
                sidebar.classList.add("active");
            } else {
                sidebar.classList.add("hidden");
                sidebar.classList.remove("active");
            }
        });

        // Show container
        this.sidebarContainer.classList.remove("hidden");
        this.currentSidebar = sidebarId;
    }

    hide() {
        // Remove active class from all buttons
        this.toggleButtons.forEach((btn) => btn.classList.remove("active"));

        // Hide all sidebars
        this.sidebars.forEach((sidebar) => {
            sidebar.classList.add("hidden");
            sidebar.classList.remove("active");
        });

        // Hide the entire container
        this.sidebarContainer.classList.add("hidden");
    }

    isHidden() {
        return this.sidebarContainer.classList.contains("hidden");
    }

    // renderCurrentSidebar() {
    //     // if (this.currentSidebar === "files") {
    //     //     renderFilesSidebar();
    //     // } else if (this.currentSidebar === "errors") {
    //     //     renderErrorsSidebar();
    //     // }
    // }
}

// Initialize sidebar manager
// const sidebarManager = new SidebarManager();
// sidebarManager.toggleSidebar("files");
// Export for use in other modules
export { SidebarManager };
