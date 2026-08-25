function setActiveNav(viewId) {\n    document.querySelectorAll('#admin-nav .sidebar-nav-item').forEach(el => {\n      el.classList.toggle('active', el.dataset.view === viewId);\n    });\n  }
