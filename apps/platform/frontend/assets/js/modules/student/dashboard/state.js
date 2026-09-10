// modules/student/dashboard/state.js — StudentDashboard shared state + view routing.
//
// Holds shared state as class properties and provides the core navigation
// and view registry methods. The class is completed by sidebar.js and
// bootstrap.js (which extend StudentDashboard.prototype).

"use strict";

class StudentDashboard {
  constructor() {
    this.token = localStorage.getItem("casuya_token");
    this.payload = decodeToken(this.token);
    this._navStack = [];
    this._subtopicLessonList = [];
    this._recentlyViewedCache = null;
    this._recentlyViewedCacheTs = 0;
    this._views = {};
    this._navItems = null;
  }

  // ── Recently-viewed cache (localStorage, 5 s TTL) ──────────────────
  getRecentlyViewed() {
    const now = Date.now();
    if (this._recentlyViewedCache === null || now - this._recentlyViewedCacheTs > 5000) {
      this._recentlyViewedCache = JSON.parse(localStorage.getItem("casuya_recently_viewed") || "[]");
      this._recentlyViewedCacheTs = now;
    }
    return this._recentlyViewedCache;
  }

  // ── Navigation helpers ──────────────────────────────────────────────
  goBack() {
    if (this._navStack.length > 0) {
      const prev = this._navStack.pop();
      prev();
    } else {
      this.callView("dashboard");
    }
  }

  showView(content) {
    const el = document.getElementById("student-content");
    if (el) el.innerHTML = content;
  }

  setActiveNav(viewId) {
    if (!this._navItems) {
      this._navItems = document.querySelectorAll("#student-nav .sidebar-nav-item");
    }
    this._navItems.forEach(el => {
      el.classList.toggle("active", el.dataset.view === viewId);
    });
  }

  navigateTo(view) {
    if (this._views[view]) {
      location.hash = view;
      this._views[view]();
    }
  }

  // ── View registry ───────────────────────────────────────────────────
  registerView(name, handler) {
    this._views[name] = handler;
  }

  callView(name, ...args) {
    if (this._views[name]) return this._views[name](...args);
  }
}