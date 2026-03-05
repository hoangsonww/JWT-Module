/* ============================================
   JWT Module Wiki — Interactive Scripts
   ============================================ */

document.addEventListener("DOMContentLoaded", () => {
  initMermaid();
  initSidebar();
  initCopyButtons();
  initCollapsibles();
  initEndpointCards();
  initSearch();
  initScrollSpy();
  initSectionAnimations();
  initMobileMenu();
});

/* ---- Mermaid Init ---- */
function initMermaid() {
  if (typeof mermaid !== "undefined") {
    mermaid.initialize({
      startOnLoad: true,
      theme: "dark",
      themeVariables: {
        darkMode: true,
        primaryColor: "#1f6feb",
        primaryTextColor: "#e6edf3",
        primaryBorderColor: "#58a6ff",
        lineColor: "#8b949e",
        secondaryColor: "#21262d",
        tertiaryColor: "#161b22",
        background: "#1c2128",
        mainBkg: "#1c2128",
        nodeBorder: "#30363d",
        clusterBkg: "#161b22",
        clusterBorder: "#30363d",
        titleColor: "#e6edf3",
        edgeLabelBackground: "#161b22",
        nodeTextColor: "#e6edf3",
        actorTextColor: "#e6edf3",
        actorBkg: "#1f6feb",
        actorBorder: "#58a6ff",
        actorLineColor: "#8b949e",
        signalColor: "#e6edf3",
        signalTextColor: "#e6edf3",
        noteBkgColor: "#21262d",
        noteTextColor: "#e6edf3",
        noteBorderColor: "#30363d",
        activationBkgColor: "#21262d",
        activationBorderColor: "#58a6ff",
        sequenceNumberColor: "#e6edf3",
        sectionBkgColor: "#21262d",
        altSectionBkgColor: "#161b22",
        taskBkgColor: "#1f6feb",
        taskTextColor: "#e6edf3",
        taskBorderColor: "#58a6ff",
        gridColor: "#30363d",
        doneTaskBkgColor: "#238636",
        activeTaskBkgColor: "#1f6feb",
        critBkgColor: "#f85149",
        todayLineColor: "#58a6ff",
        fontFamily: "Inter, -apple-system, sans-serif",
        fontSize: "14px",
      },
      flowchart: { curve: "basis", padding: 20 },
      sequence: { mirrorActors: false, bottomMarginAdj: 2 },
    });
  }
}

/* ---- Sidebar Navigation ---- */
function initSidebar() {
  const links = document.querySelectorAll(".sidebar-link");
  links.forEach((link) => {
    link.addEventListener("click", (e) => {
      // Close mobile menu on click
      const sidebar = document.querySelector(".sidebar");
      const overlay = document.querySelector(".sidebar-overlay");
      if (window.innerWidth <= 1024) {
        sidebar.classList.remove("open");
        overlay.classList.remove("active");
      }
    });
  });
}

/* ---- Copy to Clipboard ---- */
function initCopyButtons() {
  document.querySelectorAll(".copy-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const codeBlock = btn.closest(".code-block");
      const code = codeBlock.querySelector("code").textContent;
      try {
        await navigator.clipboard.writeText(code);
        btn.textContent = "Copied!";
        btn.classList.add("copied");
        setTimeout(() => {
          btn.textContent = "Copy";
          btn.classList.remove("copied");
        }, 2000);
      } catch {
        btn.textContent = "Failed";
        setTimeout(() => {
          btn.textContent = "Copy";
        }, 2000);
      }
    });
  });
}

/* ---- Collapsible Sections ---- */
function initCollapsibles() {
  document.querySelectorAll(".collapsible-trigger").forEach((trigger) => {
    trigger.addEventListener("click", () => {
      trigger.classList.toggle("open");
      const content = trigger.nextElementSibling;
      if (content && content.classList.contains("collapsible-content")) {
        content.classList.toggle("open");
      }
    });
  });
}

/* ---- Endpoint Cards ---- */
function initEndpointCards() {
  document.querySelectorAll(".endpoint-header").forEach((header) => {
    header.addEventListener("click", () => {
      const card = header.closest(".endpoint-card");
      card.classList.toggle("open");
    });
  });
}

/* ---- Search / Filter ---- */
function initSearch() {
  const searchInput = document.getElementById("sidebar-search");
  if (!searchInput) return;

  searchInput.addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase().trim();
    const links = document.querySelectorAll(".sidebar-link");

    links.forEach((link) => {
      const text = link.textContent.toLowerCase();
      const section = link.closest(".sidebar-section");
      if (!query || text.includes(query)) {
        link.style.display = "";
      } else {
        link.style.display = "none";
      }
    });

    // Also filter endpoint cards
    document.querySelectorAll(".endpoint-card").forEach((card) => {
      const text = card.textContent.toLowerCase();
      if (!query || text.includes(query)) {
        card.style.display = "";
      } else {
        card.style.display = "none";
      }
    });
  });
}

/* ---- Scroll Spy ---- */
function initScrollSpy() {
  const sections = document.querySelectorAll(".wiki-section[id]");
  const links = document.querySelectorAll(".sidebar-link");

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          links.forEach((link) => {
            link.classList.toggle("active", link.getAttribute("href") === "#" + id);
          });
        }
      });
    },
    {
      rootMargin: "-80px 0px -60% 0px",
      threshold: 0,
    },
  );

  sections.forEach((section) => observer.observe(section));
}

/* ---- Section Animations ---- */
function initSectionAnimations() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.style.animationDelay = "0.1s";
          entry.target.style.animationPlayState = "running";
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.05 },
  );

  document.querySelectorAll(".wiki-section").forEach((section) => {
    section.style.animationPlayState = "paused";
    observer.observe(section);
  });
}

/* ---- Mobile Menu ---- */
function initMobileMenu() {
  const toggle = document.querySelector(".menu-toggle");
  const sidebar = document.querySelector(".sidebar");
  const overlay = document.querySelector(".sidebar-overlay");

  if (!toggle) return;

  toggle.addEventListener("click", () => {
    sidebar.classList.toggle("open");
    overlay.classList.toggle("active");
  });

  if (overlay) {
    overlay.addEventListener("click", () => {
      sidebar.classList.remove("open");
      overlay.classList.remove("active");
    });
  }
}
