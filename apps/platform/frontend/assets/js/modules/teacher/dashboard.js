// modules/teacher/dashboard.js — TeacherDashboard class

class TeacherDashboard {
  constructor() {
    const token = localStorage.getItem("casuya_token");
    this.payload = decodeToken(token);
    this._abort = new AbortController();
    this._navItems = [];
    this.notifData = [];
    this._viewLoaders = {};
  }

  showView(content) {
    const el = document.getElementById("teacher-content");
    if (el) el.innerHTML = content;
  }

  setActiveNav(viewId) {
    this._navItems.forEach(el => {
      el.classList.toggle("active", el.dataset.view === viewId);
    });
  }

  showViewByName(viewName) {
    if (this._viewLoaders[viewName]) {
      location.hash = viewName;
      this._viewLoaders[viewName]();
    }
  }

  destroy() {
    this._abort.abort();
  }
}
