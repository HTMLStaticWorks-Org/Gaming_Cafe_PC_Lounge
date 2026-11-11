/* ==========================================================================
   REDLINE ARENA — GLOBAL INTERACTION ENGINE & DEMO STATE MANAGER (ES6)
   NOTE: Uses localStorage strictly for frontend demonstration persistence.
   Production authentication, live station telemetry, and payment gateways
   require a secure backend server and verified payment processor.
   ========================================================================== */

(() => {
  'use strict';

  const STORAGE_KEYS = {
    THEME: 'redline_theme',
    DIR: 'redline_dir',
    USER: 'redline_user',
    ACCOUNTS: 'redline_accounts',
    BOOKINGS: 'redline_bookings',
    PACKS: 'redline_packs',
    HISTORY: 'redline_history',
    PAYMENTS: 'redline_payments',
    ENQUIRIES: 'redline_enquiries'
  };

  /* Deterministic non-reversible demo hash — never stores raw passwords */
  function hashCredentialDemo(str) {
    let hash = 5381;
    const input = 'rla_demo_salt::' + String(str || '');
    for (let i = 0; i < input.length; i++) {
      hash = ((hash << 5) + hash) + input.charCodeAt(i);
      hash = hash & 0xffffffff;
    }
    return 'djb2_' + (hash >>> 0).toString(16);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function readStorage(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* Ignore storage quota errors in demo mode */
    }
  }

  /* ========================================================================
     CATALOG DATA (MATCHED TO VERIFIED SITE IMAGES)
     ======================================================================== */
  const ZONES = {
    standard: {
      id: 'standard',
      name: 'Standard PC Zone',
      short: 'Standard PC',
      rate: 6,
      img: 'images/image-19.png',
      specSummary: 'Standard Floor: Core i5-14600K • RTX 4070 • 32GB DDR5 • 240Hz IPS',
      stations: [
        { id: 'STD-01', name: 'Bay STD-01', row: 'Main Floor A', busySlots: ['18:00'] },
        { id: 'STD-02', name: 'Bay STD-02', row: 'Main Floor A', busySlots: ['15:00'] },
        { id: 'STD-03', name: 'Bay STD-03', row: 'Main Floor B', busySlots: [] },
        { id: 'STD-04', name: 'Bay STD-04', row: 'Main Floor B', busySlots: ['21:00'] }
      ]
    },
    premium: {
      id: 'premium',
      name: 'Premium PC Zone',
      short: 'Premium PC',
      rate: 9,
      img: 'images/image-81.png',
      specSummary: 'Premium Suite: Ryzen 7 7800X3D • RTX 4080 Super • 32GB • 360Hz OLED',
      stations: [
        { id: 'PRM-01', name: 'Suite PRM-01', row: 'Acoustic Pod Row', busySlots: ['12:00'] },
        { id: 'PRM-02', name: 'Suite PRM-02', row: 'Acoustic Pod Row', busySlots: [] },
        { id: 'PRM-03', name: 'Suite PRM-03', row: 'VIP Glass Wing', busySlots: ['18:00'] },
        { id: 'PRM-04', name: 'Suite PRM-04', row: 'VIP Glass Wing', busySlots: [] }
      ]
    },
    team: {
      id: 'team',
      name: 'Team Gaming Zone',
      short: 'Team Gaming',
      rate: 12,
      img: 'images/image-91.png',
      specSummary: 'Team Bootcamp: 5-Seat Bootcamp Pod • 360Hz ZOWIE Displays • LAN Sync',
      stations: [
        { id: 'TM-A', name: 'Bootcamp Alpha (5 PCs)', row: 'Esports Stage West', busySlots: ['18:00'] },
        { id: 'TM-B', name: 'Bootcamp Bravo (5 PCs)', row: 'Esports Stage East', busySlots: [] },
        { id: 'TM-C', name: 'Duo Desk Pod C', row: 'Co-Op Alcove', busySlots: ['15:00'] },
        { id: 'TM-D', name: 'Duo Desk Pod D', row: 'Co-Op Alcove', busySlots: [] }
      ]
    },
    racing: {
      id: 'racing',
      name: 'Racing Simulator Zone',
      short: 'Racing Simulator',
      rate: 14,
      img: 'images/image-107.png',
      specSummary: 'Motorsport Cockpit: Direct-Drive Wheel • Load-Cell Pedals • Triple Curved Screens',
      stations: [
        { id: 'SIM-01', name: 'Cockpit SIM-01', row: 'Apex Telemetry Bay', busySlots: ['15:00'] },
        { id: 'SIM-02', name: 'Cockpit SIM-02', row: 'Apex Telemetry Bay', busySlots: [] },
        { id: 'SIM-03', name: 'Motion Pod SIM-03', row: 'VR Track Deck', busySlots: ['21:00'] },
        { id: 'SIM-04', name: 'GT Rig SIM-04', row: 'Open Pit Lane', busySlots: [] }
      ]
    }
  };

  const TIME_SLOTS = [
    { time: '10:00', label: '10:00 AM', period: 'morning' },
    { time: '12:00', label: '12:00 PM', period: 'morning' },
    { time: '15:00', label: '03:00 PM', period: 'afternoon' },
    { time: '17:00', label: '05:00 PM', period: 'afternoon' },
    { time: '18:00', label: '06:00 PM', period: 'evening' },
    { time: '20:00', label: '08:00 PM', period: 'evening' },
    { time: '21:00', label: '09:00 PM', period: 'evening' },
    { time: '23:00', label: '11:00 PM', period: 'evening' }
  ];

  const HOUR_PACKS = [
    { id: 'quick-1h', name: 'Quick Play – 1 Hour', hours: 1, price: 6, validity: 'Same Day Pass', badge: 'Entry' },
    { id: 'power-3h', name: 'Power Session – 3 Hours', hours: 3, price: 16, validity: '14 Days Rollover', badge: 'Value' },
    { id: 'pro-5h', name: 'Pro Gamer – 5 Hours', hours: 5, price: 25, validity: '30 Days Rollover', badge: 'Recommended' },
    { id: 'ultimate-10h', name: 'Ultimate Pack – 10 Hours', hours: 10, price: 45, validity: '60 Days Rollover', badge: 'Best Rate' }
  ];

  const GAMES_CATALOG = [
    {
      id: 'valorant',
      title: 'Valorant Tactical 5v5',
      category: 'FPS',
      zone: 'premium',
      img: 'images/image-16.png',
      players: '5v5 Competitive',
      mode: 'PC Arena (240Hz–360Hz)',
      desc: 'Precision character-driven tactical shooter pre-configured on high-refresh gaming bays with low-latency peripherals.'
    },
    {
      id: 'cs2',
      title: 'Counter-Strike 2',
      category: 'FPS',
      zone: 'team',
      img: 'images/image-77.png',
      players: '5v5 LAN & Premier',
      mode: 'Bootcamp & Pro Stations',
      desc: 'Classic competitive round-based shooter tuned for crisp frame pacing on team bootcamp rows and solo tournament pods.'
    },
    {
      id: 'lol',
      title: 'League of Legends',
      category: 'Adventure',
      zone: 'team',
      img: 'images/image-75.png',
      players: '5v5 Summoner Rift',
      mode: 'Team Rows & Stream Pods',
      desc: 'Fast-paced MOBA action equipped with dual-display streaming rigs and synchronized squad comms across connected booths.'
    },
    {
      id: 'dota2',
      title: 'Dota 2 Arena',
      category: 'Adventure',
      zone: 'standard',
      img: 'images/image-65.png',
      players: '5v5 Strategy',
      mode: 'Standard & Bootcamp Rows',
      desc: 'Deep tactical lane combat ready on numbered cafe bays with noise-isolating headsets and mechanical keyboards.'
    },
    {
      id: 'gt-sim',
      title: 'GT3 Circuit Simulators',
      category: 'Racing',
      zone: 'racing',
      img: 'images/image-96.png',
      players: 'Solo Time Trial / LAN Grid',
      mode: 'Aluminum Sim Cockpits',
      desc: 'Full-telemetry motorsport simulation on triple-wide curved screens with force-feedback steering and aluminum pedals.'
    },
    {
      id: 'rocket-league',
      title: 'Rocket League Arena',
      category: 'Sports',
      zone: 'standard',
      img: 'images/image-88.png',
      players: '2v2 / 3v3 / Couch Co-Op',
      mode: 'PC & Console Bays',
      desc: 'High-flying vehicular soccer ready for quick 1-hour sprints or team scrims with controllers on request.'
    },
    {
      id: 'fortnite',
      title: 'Fortnite Battle Royale',
      category: 'Battle Royale',
      zone: 'standard',
      img: 'images/image-10.png',
      players: 'Solo / Duos / Squads',
      mode: 'Creator & Standard PCs',
      desc: 'High-frame-rate battle royale building and zero-build matches with creator capture monitors for highlight reels.'
    },
    {
      id: 'cyber-rpg',
      title: 'Cyberpunk Open-World RPG',
      category: 'Open World',
      zone: 'premium',
      img: 'images/image-82.png',
      players: 'Single-Player Showcase',
      mode: 'RTX Liquid-Cooled Rigs',
      desc: 'Ultra-settings ray-traced city exploration showcasing liquid-cooled GPU builds and ultrawide OLED monitors.'
    },
    {
      id: 'nfs-heat',
      title: 'Street Drift & Arcade Racing',
      category: 'Racing',
      zone: 'racing',
      img: 'images/image-92.png',
      players: '1–2 Players Console / Wheel',
      mode: 'Private Booth & Sim Bays',
      desc: 'Midnight street racing across console pods and cockpit rigs with zero-setup seat selection.'
    },
    {
      id: 'fc25',
      title: 'EA Sports FC 25 Lounge',
      category: 'Sports',
      zone: 'standard',
      img: 'images/image-27.png',
      players: '1v1 / 2v2 Local Co-Op',
      mode: 'Recliner Console Lounge',
      desc: 'Big-screen console football matchups for group hangouts on plush lounge recliners with DualSense controllers.'
    },
    {
      id: 'horizon-ps5',
      title: 'Horizon & PS5 Epics',
      category: 'Adventure',
      zone: 'premium',
      img: 'images/image-94.png',
      players: '1–2 Players',
      mode: 'PS5 Lounge Theater',
      desc: 'Expansive console open-world adventures rendered in 4K HDR inside dedicated PlayStation chill lounges.'
    },
    {
      id: 'street-fps',
      title: 'Triple-Screen Tactical Ops',
      category: 'Battle Royale',
      zone: 'premium',
      img: 'images/image-42.png',
      players: 'Squad / Custom Lobby',
      mode: 'Triple-Monitor Pro Pods',
      desc: 'Panoramic field-of-view combat across three synchronized gaming monitors built for situational awareness.'
    }
  ];

  const STATION_DETAILS = {
    standard: {
      title: 'Standard Gaming PC',
      img: 'images/image-50.png',
      rate: '$6 / hr',
      specs: [
        'Processor: Intel Core i5-14600K',
        'Graphics: NVIDIA GeForce RTX 4070 12GB',
        'Memory & Storage: 32GB DDR5 • 2TB NVMe SSD',
        'Display: 27" 240Hz Fast IPS Esports Monitor',
        'Peripherals: Mechanical TKL Keyboard, Lightweight Mouse, Closed-Back Headset'
      ],
      summary: 'Balanced competitive rigs built for smooth 240fps FPS, MOBA, and Battle Royale play with ergonomic seating.'
    },
    premium: {
      title: 'Premium Gaming PC',
      img: 'images/image-80.png',
      rate: '$9 / hr',
      specs: [
        'Processor: AMD Ryzen 7 7800X3D',
        'Graphics: NVIDIA GeForce RTX 4080 Super 16GB (Liquid Cooled)',
        'Memory & Storage: 32GB DDR5-6000 • 2TB Gen4 NVMe',
        'Display: 27" 360Hz OLED / Curved Ultrawide Options',
        'Peripherals: Pro Optical Keyboard, Wireless Esports Mouse, Studio Audio'
      ],
      summary: 'High-frame-rate flagship stations featuring custom AIO cooling, acoustic separation, and ultra-low input lag.'
    },
    team: {
      title: 'Team Gaming Station',
      img: 'images/image-25.png',
      rate: '$12 / hr per seat',
      specs: [
        'Layout: 5-Seat Enclosed Bootcamp Row or Duo Co-Op Bays',
        'Hardware: Matched RTX 4080-class Tournament Builds',
        'Display: 24.5" 360Hz BenQ ZOWIE Tournament Panels',
        'Network: Dedicated Low-Jitter Wired LAN Switch',
        'Extras: Overhead Rig Displays, Coach Viewing Space, Whiteboards'
      ],
      summary: 'Synchronized 5-player scrim rooms designed for collegiate teams, tournament bootcamps, and friend squads.'
    },
    racing: {
      title: 'Racing Simulator',
      img: 'images/image-102.png',
      rate: '$14 / hr',
      specs: [
        'Chassis: 80/20 Aluminum-Extrusion Bucket Seat Cockpit',
        'Force Feedback: Direct-Drive Servo Wheelbase + H-Pattern/Sequential Shifter',
        'Pedals: 3-Pedal Load-Cell Metal Assembly',
        'Display: Triple Curved Monitors or 49" Super-Ultrawide Horizon Screen',
        'Titles: GT3 Circuit Sims, F1 Open-Wheelers & Street Drift Pack'
      ],
      summary: 'Dedicated motorsport cockpits engineered for realistic braking feel, wide cockpit vision, and lap-time competition.'
    }
  };

  const EVENTS_DATA = [
    {
      id: 'fps-champ',
      title: 'Redline FPS Championship',
      date: 'Saturday, Nov 21 • 4:00 PM',
      img: 'images/image-60.png',
      zone: 'Main Stage & Bootcamp Rows',
      format: '5v5 Double Elimination • Best-of-3 Finals',
      desc: 'Flagship tactical shooter tournament played on stage rows with uniform 360Hz displays, tournament headsets, and spectator seating.'
    },
    {
      id: 'moba-weekend',
      title: 'Multiplayer Weekend & MOBA Clash',
      date: 'Sunday, Nov 29 • 2:00 PM',
      img: 'images/image-64.png',
      zone: 'Arena Floor & Console Lounge',
      format: '5v5 Draft + Casual Duo Lobbies',
      desc: 'Community MOBA tournament paired with open co-op console zones so solo guests and full squads can jump in smoothly.'
    },
    {
      id: 'racing-challenge',
      title: 'Apex Bracket & GT Track Night',
      date: 'Friday, Dec 04 • 7:00 PM',
      img: 'images/image-74.png',
      zone: 'Sim Racing Deck & Stream Desk',
      format: 'Hot-Lap Leaderboard + Live Bracket Feed',
      desc: 'Time-attack leaderboard challenge across aluminum sim cockpits with live caster desk telemetry and bracket tracking.'
    },
    {
      id: 'community-night',
      title: 'Community Gaming Night',
      date: 'Every Wednesday • 6:00 PM',
      img: 'images/image-18.png',
      zone: 'Full Arena Access',
      format: 'Drop-In Mixers • Party Games & Scrims',
      desc: 'Mid-week open social mixer welcoming new gamers, college groups, and casual players for friendly LAN rotations.'
    }
  ];

  /* ========================================================================
     DEMO ACCOUNT SEEDING (LOCALSTORAGE)
     ======================================================================== */
  function ensureDemoSeed() {
    const existingAccounts = readStorage(STORAGE_KEYS.ACCOUNTS, null);
    if (!existingAccounts) {
      const demoAccount = {
        id: 'USR-1001',
        name: 'Alex Mercer',
        gamerTag: 'ALEX_VIPER',
        email: 'alex@redlinearena.demo',
        phone: '+1 (555) 019-2840',
        authHash: hashCredentialDemo('RedlineDemo2026'),
        preferredZone: 'premium',
        memberTier: 'Arena Member',
        availableHours: 11.5,
        totalHoursPlayed: 64.5,
        completedSessions: 22
      };
      writeStorage(STORAGE_KEYS.ACCOUNTS, [demoAccount]);
      writeStorage(STORAGE_KEYS.USER, demoAccount);
    }

    if (!readStorage(STORAGE_KEYS.BOOKINGS, null)) {
      writeStorage(STORAGE_KEYS.BOOKINGS, [
        {
          id: 'RLA-9042',
          userEmail: 'alex@redlinearena.demo',
          customerName: 'Alex Mercer',
          customerPhone: '+1 (555) 019-2840',
          zone: 'premium',
          zoneLabel: 'Premium PC Zone',
          stationId: 'PRM-03',
          stationName: 'Suite PRM-03',
          date: getFutureDateStr(2),
          slot: '18:00',
          slotLabel: '06:00 PM',
          duration: 3,
          price: 27,
          notes: 'Prefer left-hand desk clearance.',
          status: 'Confirmed',
          sessionOwned: true,
          createdAt: new Date().toISOString()
        },
        {
          id: 'RLA-9108',
          userEmail: 'alex@redlinearena.demo',
          customerName: 'Alex Mercer',
          customerPhone: '+1 (555) 019-2840',
          zone: 'racing',
          zoneLabel: 'Racing Simulator Zone',
          stationId: 'SIM-01',
          stationName: 'Cockpit SIM-01',
          date: getFutureDateStr(5),
          slot: '15:00',
          slotLabel: '03:00 PM',
          duration: 2,
          price: 28,
          notes: 'GT3 endurance warm-up session.',
          status: 'Confirmed',
          sessionOwned: true,
          createdAt: new Date().toISOString()
        }
      ]);
    }

    if (!readStorage(STORAGE_KEYS.PACKS, null)) {
      writeStorage(STORAGE_KEYS.PACKS, [
        {
          id: 'PCK-401',
          name: 'Ultimate Pack – 10 Hours',
          hoursPurchased: 10,
          hoursRemaining: 8.5,
          price: 45,
          purchaseDate: getPastDateStr(10),
          expiryDate: getFutureDateStr(50),
          status: 'Active',
          userEmail: 'alex@redlinearena.demo'
        },
        {
          id: 'PCK-388',
          name: 'Power Session – 3 Hours',
          hoursPurchased: 3,
          hoursRemaining: 3.0,
          price: 16,
          purchaseDate: getPastDateStr(3),
          expiryDate: getFutureDateStr(11),
          status: 'Active',
          userEmail: 'alex@redlinearena.demo'
        }
      ]);
    }

    if (!readStorage(STORAGE_KEYS.HISTORY, null)) {
      writeStorage(STORAGE_KEYS.HISTORY, [
        { sessionId: 'SES-7821', gameOrZone: 'Valorant • Premium PC Zone', stationId: 'PRM-02', date: getPastDateStr(2), duration: 3.0, status: 'Completed' },
        { sessionId: 'SES-7794', gameOrZone: 'GT3 Circuit Sim • Racing Deck', stationId: 'SIM-02', date: getPastDateStr(4), duration: 2.0, status: 'Completed' },
        { sessionId: 'SES-7740', gameOrZone: 'Counter-Strike 2 • Bootcamp', stationId: 'TM-A', date: getPastDateStr(6), duration: 4.0, status: 'Completed' },
        { sessionId: 'SES-7691', gameOrZone: 'League of Legends • Standard PC', stationId: 'STD-03', date: getPastDateStr(9), duration: 2.5, status: 'Completed' },
        { sessionId: 'SES-7635', gameOrZone: 'Cyberpunk RTX • Premium PC', stationId: 'PRM-04', date: getPastDateStr(12), duration: 3.5, status: 'Completed' },
        { sessionId: 'SES-7598', gameOrZone: 'Fortnite Squads • Standard PC', stationId: 'STD-01', date: getPastDateStr(15), duration: 2.0, status: 'Completed' }
      ]);
    }

    if (!readStorage(STORAGE_KEYS.PAYMENTS, null)) {
      writeStorage(STORAGE_KEYS.PAYMENTS, [
        { txId: 'TX-8841', item: 'Ultimate Pack – 10 Hours', date: getPastDateStr(10), amount: '$45.00', status: 'Credited' },
        { txId: 'TX-8790', item: 'Power Session – 3 Hours', date: getPastDateStr(3), amount: '$16.00', status: 'Credited' },
        { txId: 'TX-8652', item: 'Quick Play – 1 Hour', date: getPastDateStr(19), amount: '$6.00', status: 'Credited' }
      ]);
    }
  }

  function getFutureDateStr(offsetDays) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().split('T')[0];
  }

  function getPastDateStr(offsetDays) {
    const d = new Date();
    d.setDate(d.getDate() - offsetDays);
    return d.toISOString().split('T')[0];
  }

  function getCurrentUser() {
    return readStorage(STORAGE_KEYS.USER, null);
  }

  function setCurrentUser(user) {
    if (user) {
      writeStorage(STORAGE_KEYS.USER, user);
      const accounts = readStorage(STORAGE_KEYS.ACCOUNTS, []);
      const idx = accounts.findIndex(a => a.email.toLowerCase() === user.email.toLowerCase());
      if (idx >= 0) {
        accounts[idx] = { ...accounts[idx], ...user };
        writeStorage(STORAGE_KEYS.ACCOUNTS, accounts);
      }
    } else {
      localStorage.removeItem(STORAGE_KEYS.USER);
    }
  }

  /* ========================================================================
     GLOBAL THEME TOGGLE (LIGHT / DARK PERSISTED IN LOCALSTORAGE)
     ======================================================================== */
  function initTheme() {
    const saved = localStorage.getItem(STORAGE_KEYS.THEME) || 'dark';
    applyTheme(saved);

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-theme-toggle]');
      if (!btn) return;
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
    });
  }

  function applyTheme(theme) {
    const valid = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', valid);
    try {
      localStorage.setItem(STORAGE_KEYS.THEME, valid);
    } catch { /* ignore */ }
    document.querySelectorAll('[data-theme-label]').forEach(el => {
      el.textContent = valid === 'dark' ? 'Dark Mode' : 'Light Mode';
    });
    document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
      btn.setAttribute('aria-pressed', String(valid === 'light'));
    });
  }

  /* ========================================================================
     GLOBAL RTL / LTR DIRECTION TOGGLE (PERSISTED IN LOCALSTORAGE)
     ======================================================================== */
  function initRTL() {
    const saved = localStorage.getItem(STORAGE_KEYS.DIR) || 'ltr';
    applyDirection(saved);

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-rtl-toggle]');
      if (!btn) return;
      const current = document.documentElement.getAttribute('dir') || 'ltr';
      const next = current === 'rtl' ? 'ltr' : 'rtl';
      applyDirection(next);
    });
  }

  function applyDirection(dir) {
    const valid = dir === 'rtl' ? 'rtl' : 'ltr';
    document.documentElement.setAttribute('dir', valid);
    try {
      localStorage.setItem(STORAGE_KEYS.DIR, valid);
    } catch { /* ignore */ }
    document.querySelectorAll('[data-rtl-label]').forEach(el => {
      el.textContent = valid === 'rtl' ? 'RTL Mode' : 'LTR Mode';
    });
    document.querySelectorAll('[data-rtl-toggle]').forEach(btn => {
      btn.setAttribute('aria-pressed', String(valid === 'rtl'));
    });
  }

  /* ========================================================================
     STICKY NAVBAR, ACTIVE STATES & MOBILE/TABLET DRAWER
     ======================================================================== */
  function initNavigation() {
    const header = document.querySelector('.site-header');
    if (header) {
      const onScroll = () => {
        header.classList.toggle('scrolled', window.scrollY > 12);
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }

    // Highlight current page link cleanly
    const currentFile = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
    document.querySelectorAll('.nav-link, .drawer-link').forEach(link => {
      const href = (link.getAttribute('href') || '').toLowerCase();
      if (href === currentFile || (currentFile === '' && href === 'index.html')) {
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');
      }
    });

    // Mobile & Tablet Drawer controls
    const drawer = document.getElementById('mobileDrawer');
    const backdrop = document.getElementById('drawerBackdrop');
    const openBtn = document.getElementById('drawerOpenBtn');
    const closeBtn = document.getElementById('drawerCloseBtn');
    let lastTrigger = null;

    function openDrawer() {
      if (!drawer || !backdrop) return;
      lastTrigger = document.activeElement;
      drawer.classList.add('open');
      backdrop.classList.add('open');
      drawer.setAttribute('aria-hidden', 'false');
      if (openBtn) openBtn.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
      if (closeBtn) closeBtn.focus();
    }

    function closeDrawer() {
      if (!drawer || !backdrop) return;
      drawer.classList.remove('open');
      backdrop.classList.remove('open');
      drawer.setAttribute('aria-hidden', 'true');
      if (openBtn) openBtn.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      if (lastTrigger && typeof lastTrigger.focus === 'function') {
        lastTrigger.focus();
      }
    }

    if (openBtn) openBtn.addEventListener('click', openDrawer);
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    if (backdrop) backdrop.addEventListener('click', closeDrawer);

    if (drawer) {
      drawer.querySelectorAll('a').forEach(a => a.addEventListener('click', closeDrawer));
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (drawer && drawer.classList.contains('open')) closeDrawer();
        closeModal();
      }
    });
  }

  /* ========================================================================
     GLOBAL ACCESSIBLE MODAL MANAGER
     ======================================================================== */
  let modalLastFocus = null;

  function ensureModalRoot() {
    let backdrop = document.getElementById('globalModalBackdrop');
    if (backdrop) return backdrop;

    backdrop = document.createElement('div');
    backdrop.id = 'globalModalBackdrop';
    backdrop.className = 'modal-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-labelledby', 'globalModalTitle');
    backdrop.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-head">
          <h3 class="modal-title" id="globalModalTitle"></h3>
          <button type="button" class="drawer-close" id="globalModalClose" aria-label="Close modal">&times;</button>
        </div>
        <div class="modal-body" id="globalModalBody"></div>
        <div class="modal-foot" id="globalModalFoot"></div>
      </div>
    `;
    document.body.appendChild(backdrop);

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop || e.target.closest('#globalModalClose')) {
        closeModal();
      }
    });

    return backdrop;
  }

  function openModal(title, bodyHtml, footHtml) {
    const backdrop = ensureModalRoot();
    modalLastFocus = document.activeElement;
    document.getElementById('globalModalTitle').textContent = title;
    document.getElementById('globalModalBody').innerHTML = bodyHtml;
    document.getElementById('globalModalFoot').innerHTML = footHtml || '<button type="button" class="btn btn-secondary btn-sm" data-modal-dismiss>Close</button>';

    backdrop.querySelectorAll('[data-modal-dismiss]').forEach(btn => {
      btn.addEventListener('click', closeModal);
    });

    backdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
    const closeEl = document.getElementById('globalModalClose');
    if (closeEl) closeEl.focus();
  }

  function closeModal() {
    const backdrop = document.getElementById('globalModalBackdrop');
    if (!backdrop || !backdrop.classList.contains('open')) return;
    backdrop.classList.remove('open');
    document.body.style.overflow = '';
    if (modalLastFocus && typeof modalLastFocus.focus === 'function') {
      modalLastFocus.focus();
    }
  }

  /* ========================================================================
     BACK TO TOP & SCROLL REVEAL ANIMATIONS
     ======================================================================== */
  function initAnimationsAndScroll() {
    const reveals = document.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window && reveals.length) {
      const obs = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });
      reveals.forEach(el => obs.observe(el));
    } else {
      reveals.forEach(el => el.classList.add('is-visible'));
    }

    // Back to top button (skip on dashboard if not needed, or support everywhere)
    if (!document.querySelector('.back-to-top') && !document.body.classList.contains('page-dashboard')) {
      const topBtn = document.createElement('button');
      topBtn.type = 'button';
      topBtn.className = 'back-to-top';
      topBtn.setAttribute('aria-label', 'Back to top');
      topBtn.innerHTML = '&#8593;';
      document.body.appendChild(topBtn);

      topBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });

      window.addEventListener('scroll', () => {
        topBtn.classList.toggle('visible', window.scrollY > 420);
      }, { passive: true });
    }

    // Subtle Hero Parallax & 3D Tilt Effects (Respects prefers-reduced-motion)
    const allowMotion = window.matchMedia('(prefers-reduced-motion: no-preference)').matches;
    const canHover = window.matchMedia('(hover: hover)').matches;

    if (allowMotion) {
      const heroBg = document.querySelector('.hero-cinema .hero-bg-img');
      if (heroBg) {
        window.addEventListener('scroll', () => {
          const y = Math.min(window.scrollY, 700);
          heroBg.style.transform = `scale(1.04) translateY(${Math.round(y * 0.12)}px)`;
        }, { passive: true });
      }

      if (canHover) {
        document.querySelectorAll('.hero-split-media, .split-media').forEach(el => {
          el.addEventListener('mousemove', (e) => {
            const rect = el.getBoundingClientRect();
            const px = (e.clientX - rect.left) / rect.width - 0.5;
            const py = (e.clientY - rect.top) / rect.height - 0.5;
            el.style.transform = `perspective(900px) rotateX(${(-py * 4).toFixed(2)}deg) rotateY(${(px * 4).toFixed(2)}deg)`;
          });
          el.addEventListener('mouseleave', () => {
            el.style.transform = '';
          });
        });
      }
    }

    // Interactive Timeline Step Highlighting (Home 1 S5)
    const steps = document.querySelectorAll('.timeline-step');
    if (steps.length) {
      steps[0].classList.add('active');
      steps.forEach(step => {
        step.addEventListener('click', () => {
          steps.forEach(s => s.classList.remove('active'));
          step.classList.add('active');
        });
      });
    }
  }

  /* ========================================================================
     GLOBAL CLICK HANDLERS FOR GAMES, STATIONS, PACKAGES & EVENTS MODALS
     ======================================================================== */
  function initGlobalModals() {
    document.addEventListener('click', (e) => {
      // Game Details Modal
      const gameBtn = e.target.closest('[data-game-modal]');
      if (gameBtn) {
        const game = GAMES_CATALOG.find(g => g.id === gameBtn.getAttribute('data-game-modal'));
        if (game) {
          openModal(
            game.title,
            `<img src="${escapeHtml(game.img)}" alt="${escapeHtml(game.title)}" style="width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:8px;">
             <div style="display:flex;gap:8px;flex-wrap:wrap;">
               <span class="demo-badge">${escapeHtml(game.category)}</span>
               <span class="demo-badge">${escapeHtml(game.players)}</span>
               <span class="demo-badge">${escapeHtml(game.mode)}</span>
             </div>
             <p>${escapeHtml(game.desc)}</p>
             <p class="text-muted" style="font-size:0.86rem;">Note: Available on all compatible stations in our active floor library.</p>`,
            `<a href="games.html?game=${encodeURIComponent(game.id)}" class="btn btn-secondary btn-sm">Explore on Games Page</a>
             <a href="booking.html?zone=${encodeURIComponent(game.zone)}" class="btn btn-primary btn-sm">Book Compatible Station</a>`
          );
        }
        return;
      }

      // Station Details Modal
      const stationBtn = e.target.closest('[data-station-modal]');
      if (stationBtn) {
        const key = stationBtn.getAttribute('data-station-modal');
        const st = STATION_DETAILS[key];
        if (st) {
          const listHtml = st.specs.map(s => `<li>${escapeHtml(s)}</li>`).join('');
          openModal(
            st.title,
            `<img src="${escapeHtml(st.img)}" alt="${escapeHtml(st.title)}" style="width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:8px;">
             <div class="demo-badge">${escapeHtml(st.rate)}</div>
             <p>${escapeHtml(st.summary)}</p>
             <ul class="split-list">${listHtml}</ul>
             <p class="text-muted" style="font-size:0.84rem;">Every station includes sanitized peripherals, gigabit wired LAN, and climate-controlled comfort.</p>`,
            `<button type="button" class="btn btn-secondary btn-sm" data-modal-dismiss>Close</button>
             <a href="booking.html?zone=${encodeURIComponent(key)}" class="btn btn-primary btn-sm">Reserve This Station</a>`
          );
        }
        return;
      }

      // Event Details Modal
      const eventBtn = e.target.closest('[data-event-modal]');
      if (eventBtn) {
        const ev = EVENTS_DATA.find(item => item.id === eventBtn.getAttribute('data-event-modal'));
        if (ev) {
          openModal(
            ev.title,
            `<img src="${escapeHtml(ev.img)}" alt="${escapeHtml(ev.title)}" style="width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:8px;">
             <div class="demo-badge">${escapeHtml(ev.date)}</div>
             <p><strong>Zone:</strong> ${escapeHtml(ev.zone)}</p>
             <p><strong>Format:</strong> ${escapeHtml(ev.format)}</p>
             <p>${escapeHtml(ev.desc)}</p>
             <p class="text-muted" style="font-size:0.84rem;">Arrive 20 minutes prior to start time for station warm-up and check-in.</p>`,
            `<a href="booking.html?zone=team" class="btn btn-secondary btn-sm">Book Squad Warm-Up</a>
             <a href="contact.html?topic=tournament" class="btn btn-primary btn-sm">Register Interest</a>`
          );
        }
        return;
      }

      // Footer Social Community Channels
      const socialLink = e.target.closest('a[href^="#social-"]');
      if (socialLink) {
        e.preventDefault();
        const ch = (socialLink.getAttribute('aria-label') || 'Community').trim();
        openModal(
          `REDLINE ARENA on ${ch}`,
          `<div class="demo-badge">@redlinearena</div>
           <p>Follow REDLINE ARENA on <strong>${escapeHtml(ch)}</strong> for weekly tournament brackets, late-night LAN highlights, rig upgrades, and community drop-in specials.</p>
           <div class="card-meta-list">
             <div><strong>Community Events:</strong> Weekly Wednesday Mixers &amp; Saturday Brackets</div>
             <div><strong>Arena Floor Location:</strong> 420 Redline Blvd, Sector 4 Esports District</div>
           </div>`,
          `<a href="contact.html" class="btn btn-secondary btn-sm">Contact Lounge Desk</a>
           <a href="booking.html" class="btn btn-primary btn-sm">Book a Gaming Slot</a>`
        );
        return;
      }

      // Package Purchase Modal
      const packBtn = e.target.closest('[data-buy-pack]');
      if (packBtn) {
        const packId = packBtn.getAttribute('data-buy-pack');
        const pack = HOUR_PACKS.find(p => p.id === packId);
        if (pack) {
          openPackPurchaseModal(pack);
        }
      }
    });
  }

  function openPackPurchaseModal(pack) {
    const user = getCurrentUser();
    const who = user ? `${user.name} (${user.gamerTag})` : 'Guest Wallet (credits active ALEX_VIPER profile)';
    openModal(
      'Hour Pack Selection',
      `<div class="demo-badge">Instant Wallet Credit</div>
       <h4 style="font-family:var(--font-display);font-size:1.3rem;">${escapeHtml(pack.name)}</h4>
       <p class="text-muted">Account: <strong>${escapeHtml(who)}</strong></p>
       <div class="card-meta-list">
         <div><strong>Hours Credited:</strong> +${pack.hours} Hours</div>
         <div><strong>Package Rate:</strong> $${pack.price}.00</div>
         <div><strong>Validity Policy:</strong> ${escapeHtml(pack.validity)}</div>
       </div>
       <p class="text-muted" style="font-size:0.86rem;">Confirming adds ${pack.hours} hours immediately to your Available Hours balance and logs the pack inside your Gamer Dashboard.</p>`,
      `<button type="button" class="btn btn-secondary btn-sm" data-modal-dismiss>Cancel</button>
       <button type="button" class="btn btn-primary btn-sm" id="confirmDemoPackBtn">Confirm Pack (+${pack.hours}h)</button>`
    );

    const confirmBtn = document.getElementById('confirmDemoPackBtn');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        purchasePackDemo(pack);
        openModal(
          'Hour Pack Added',
          `<p><strong>${escapeHtml(pack.name)}</strong> has been credited to your account wallet.</p>
           <p class="text-muted">Your Available Hours (+${pack.hours}h) and payment record are now updated in your Gamer Dashboard.</p>`,
          `<a href="dashboard.html" class="btn btn-primary btn-sm">Open Gamer Dashboard</a>
           <a href="booking.html?pack=${encodeURIComponent(pack.id)}" class="btn btn-secondary btn-sm">Book a PC Now</a>`
        );
      });
    }
  }

  function purchasePackDemo(pack) {
    let user = getCurrentUser();
    if (!user) {
      const accounts = readStorage(STORAGE_KEYS.ACCOUNTS, []);
      user = accounts[0];
    }
    if (!user) return;

    user.availableHours = Number((Number(user.availableHours || 0) + pack.hours).toFixed(1));
    setCurrentUser(user);

    const packs = readStorage(STORAGE_KEYS.PACKS, []);
    packs.unshift({
      id: 'PCK-' + Math.floor(100 + Math.random() * 899),
      name: pack.name,
      hoursPurchased: pack.hours,
      hoursRemaining: pack.hours,
      price: pack.price,
      purchaseDate: getFutureDateStr(0),
      expiryDate: getFutureDateStr(pack.hours >= 10 ? 60 : pack.hours >= 5 ? 30 : 14),
      status: 'Active',
      userEmail: user.email
    });
    writeStorage(STORAGE_KEYS.PACKS, packs);

    const payments = readStorage(STORAGE_KEYS.PAYMENTS, []);
    payments.unshift({
      txId: 'TX-' + Math.floor(1000 + Math.random() * 8999),
      item: pack.name,
      date: getFutureDateStr(0),
      amount: `$${pack.price}.00`,
      status: 'Credited'
    });
    writeStorage(STORAGE_KEYS.PAYMENTS, payments);

    if (typeof window.__refreshDashboard === 'function') {
      window.__refreshDashboard();
    }
  }

  /* ========================================================================
     PAGE MODULE: HOME 1 (HOTSPOTS + TIMELINE + DEMO TESTIMONIALS)
     ======================================================================== */
  function initHome1() {
    // Hardware Hotspot Explorer
    const hotspotData = {
      cpu: {
        title: 'High-Clock Multi-Core Processor',
        badge: 'CPU Architecture',
        spec: '14th-Gen Core i7 / Ryzen 7 X3D Class • Up to 5.6GHz Boost',
        desc: 'Delivers consistent minimum frame rates in CPU-heavy esports titles like Valorant, Counter-Strike 2, and competitive Battle Royales.'
      },
      gpu: {
        title: 'Triple-Fan GeForce RTX Graphics',
        badge: 'GPU Rendering',
        spec: 'GeForce RTX 4070 / 4080 Super Class • DLSS Frame Generation',
        desc: 'Powers ray-traced open worlds and high-refresh 240Hz–360Hz competitive displays without thermal throttling.'
      },
      cooling: {
        title: 'Liquid AIO & High-Airflow Chassis',
        badge: 'Thermal Engineering',
        spec: '240mm / 360mm Dual-Chamber Liquid Cooling + Quiet PWM Fans',
        desc: 'Keeps internal temperatures steady across marathon 5-hour sessions while maintaining quiet acoustic control.'
      },
      ram: {
        title: 'High-Speed DDR5 Memory & Gen4 NVMe',
        badge: 'Memory & Storage',
        spec: '32GB DDR5-6000 • 2TB–4TB NVMe Gen4 SSDs',
        desc: 'Near-instant map loading, fast alt-tabbing to Discord/OBS, and spacious pre-installed multiplayer libraries.'
      },
      display: {
        title: '240Hz–360Hz Esports Displays',
        badge: 'Visual Clarity',
        spec: '0.5ms–1ms GtG Response • Adaptive Sync • Ergonomic Arms',
        desc: 'Crystal-clear motion tracking designed for micro-flicks, smoke sprays, and tight apex racing lines.'
      },
      peripherals: {
        title: 'Tournament-Grade Desk Peripherals',
        badge: 'Control & Audio',
        spec: 'Mechanical Switches • Lightweight Optical Mouse • Low-Latency Headset',
        desc: 'Calibrated switches, oversized speed desk mats, and spatial audio headsets cleaned between every session.'
      }
    };

    const hotspotStage = document.getElementById('h1HotspotStage');
    if (hotspotStage) {
      const pins = hotspotStage.querySelectorAll('.hotspot-pin');
      const tabs = document.querySelectorAll('[data-hotspot-tab]');
      const badgeEl = document.getElementById('hotspotBadge');
      const titleEl = document.getElementById('hotspotTitle');
      const specEl = document.getElementById('hotspotSpec');
      const descEl = document.getElementById('hotspotDesc');

      function selectHotspot(key) {
        const info = hotspotData[key];
        if (!info) return;
        pins.forEach(p => p.classList.toggle('active', p.dataset.hotspot === key));
        tabs.forEach(t => t.classList.toggle('active', t.dataset.hotspotTab === key));
        badgeEl.textContent = info.badge;
        titleEl.textContent = info.title;
        specEl.textContent = info.spec;
        descEl.textContent = info.desc;
      }

      pins.forEach(pin => pin.addEventListener('click', () => selectHotspot(pin.dataset.hotspot)));
      tabs.forEach(tab => tab.addEventListener('click', () => selectHotspot(tab.dataset.hotspotTab)));
    }

    // Testimonials Carousel
    const testimonials = [
      {
        quote: '“Clean rigs, locked frame pacing in Valorant, and zero setup hassle when our five-stack booked the Bootcamp row for weekend scrims.”',
        author: 'R. Vance — Competitive FPS Regular'
      },
      {
        quote: '“The triple-screen racing cockpit feels solid under heavy braking, and booking a two-hour track slot from mobile took under a minute.”',
        author: 'D. Sato — Sim Racing Regular'
      },
      {
        quote: '“Switching between the PC floor and the PS5 console lounge with friends made Friday night sessions way better than playing solo at home.”',
        author: 'K. Lin — Squad & Console Member'
      },
      {
        quote: '“Dual-monitor creator stations let me capture clean footage and review match replays right after our local bracket night.”',
        author: 'M. Thorne — Streamer & Bracket Captain'
      }
    ];

    const quoteEl = document.getElementById('testimonialQuote');
    if (quoteEl) {
      let idx = 0;
      const authorEl = document.getElementById('testimonialAuthor');
      const dots = document.querySelectorAll('#testimonialDots .carousel-dot');

      function renderSlide(nextIdx) {
        idx = (nextIdx + testimonials.length) % testimonials.length;
        quoteEl.textContent = testimonials[idx].quote;
        authorEl.textContent = testimonials[idx].author;
        dots.forEach((d, i) => d.classList.toggle('active', i === idx));
      }

      document.getElementById('prevTestimonial')?.addEventListener('click', () => renderSlide(idx - 1));
      document.getElementById('nextTestimonial')?.addEventListener('click', () => renderSlide(idx + 1));
      dots.forEach((d, i) => d.addEventListener('click', () => renderSlide(i)));
    }
  }

  /* ========================================================================
     PAGE MODULE: HOME 2 (STYLE EXPLORER, ZONES, GAME SEARCH, HARDWARE, QUICK BOOK)
     ======================================================================== */
  function initHome2() {
    // Section 02: Gaming Style Explorer
    const styleData = {
      competitive: {
        title: 'Competitive FPS & Esports Ready',
        station: 'Recommended: Team Bootcamp & Premium 360Hz Pods',
        games: 'Suggested Titles: Valorant, Counter-Strike 2, Apex Shooters',
        desc: 'Low-latency wired rigs with BenQ-grade 240Hz–360Hz displays, lightweight mice, and team comms isolation.',
        img: 'images/image-71.png',
        alt: 'Focused esports player behind tournament high-refresh monitor',
        ctaHref: 'booking.html?zone=team',
        ctaLabel: 'Book Competitive Setup'
      },
      casual: {
        title: 'Relaxed Lounge & Co-Op Exploration',
        station: 'Recommended: Ambient Ultrawide Pods & PS5 Lounge',
        games: 'Suggested Titles: Open-World RPGs, Horizon Adventures, Party Hits',
        desc: 'Sink into ergonomic seating with atmospheric lighting, dual screens for Discord, and effortless pickup-and-play sessions.',
        img: 'images/image-49.png',
        alt: 'Space-themed ultrawide lounge station with ambient lighting',
        ctaHref: 'booking.html?zone=standard',
        ctaLabel: 'Book Lounge Station'
      },
      racing: {
        title: 'Motorsport Telemetry & Track Realism',
        station: 'Recommended: Aluminum GT Sim Cockpits',
        games: 'Suggested Titles: GT3 Circuit Sims, Open-Wheelers, Drift Challenges',
        desc: 'Feel curbs and traction loss through direct-drive steering wheels, load-cell metal pedals, and ultrawide track horizons.',
        img: 'images/image-103.png',
        alt: 'Gloved sim racer gripping wheel on ultrawide formula circuit monitor',
        ctaHref: 'booking.html?zone=racing',
        ctaLabel: 'Book Sim Cockpit'
      },
      multiplayer: {
        title: 'Squad Nights & LAN Party Rows',
        station: 'Recommended: Side-by-Side PC Rows & Console Booths',
        games: 'Suggested Titles: League of Legends, Fortnite, EA FC 25',
        desc: 'Reserve connected desks side by side so your entire friend group shares callouts, snacks, and clutch moments live.',
        img: 'images/image-4.png',
        alt: 'Row of friends wearing headsets playing MOBA games together at LAN desks',
        ctaHref: 'booking.html?zone=team',
        ctaLabel: 'Book Squad Row'
      }
    };

    const styleStage = document.getElementById('h2StyleExplorer');
    if (styleStage) {
      const styleButtons = styleStage.querySelectorAll('[data-style-key]');
      styleButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          const item = styleData[btn.dataset.styleKey];
          if (!item) return;
          styleButtons.forEach(b => b.classList.toggle('active', b === btn));
          const sImg = document.getElementById('h2StyleImg');
          if (sImg) { sImg.src = item.img; sImg.alt = item.alt; }
          document.getElementById('h2StyleTitle').textContent = item.title;
          document.getElementById('h2StyleStation').textContent = item.station;
          document.getElementById('h2StyleGames').textContent = item.games;
          document.getElementById('h2StyleDesc').textContent = item.desc;
          const cta = document.getElementById('h2StyleCta');
          cta.href = item.ctaHref;
          cta.textContent = item.ctaLabel;
        });
      });
    }

    // Section 03: Explore Your Gaming Zones
    const h2Zones = {
      standard: {
        title: 'Standard PC Zone',
        rate: '$6 / hr',
        desc: 'Red-accented main floor bays featuring ergonomic racing chairs, mechanical RGB keyboards, and 240Hz monitors ready for solo or duo queues.',
        img: 'images/image-32.png',
        href: 'booking.html?zone=standard'
      },
      premium: {
        title: 'Premium PC Zone',
        rate: '$9 / hr',
        desc: 'Elevated glass-sided liquid-cooled RTX rigs with curved displays and sound-damped seating built for demanding titles.',
        img: 'images/image-17.png',
        href: 'booking.html?zone=premium'
      },
      team: {
        title: 'Team Gaming Zone',
        rate: '$12 / hr per seat',
        desc: 'Dedicated 5v5 bootcamp rows with Cougar seating, ASUS TUF displays, low-ping wired LAN, and steps from the refreshment counter.',
        img: 'images/image-23.png',
        href: 'booking.html?zone=team'
      },
      racing: {
        title: 'Racing Simulator Zone',
        rate: '$14 / hr',
        desc: 'Aluminum-profile GT3 cockpits with gated shifters, drilled alloy pedals, and wraparound circuit monitors.',
        img: 'images/image-106.png',
        href: 'booking.html?zone=racing'
      }
    };

    const h2ZoneWrap = document.getElementById('h2ZoneExplorer');
    if (h2ZoneWrap) {
      const zBtns = h2ZoneWrap.querySelectorAll('[data-h2-zone]');
      zBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const z = h2Zones[btn.dataset.h2Zone];
          if (!z) return;
          zBtns.forEach(b => b.classList.toggle('active', b === btn));
          const zImg = document.getElementById('h2ZoneImg');
          if (zImg) { zImg.src = z.img; zImg.alt = z.title; }
          document.getElementById('h2ZoneTitle').textContent = z.title;
          document.getElementById('h2ZoneRate').textContent = z.rate;
          document.getElementById('h2ZoneDesc').textContent = z.desc;
          document.getElementById('h2ZoneBook').href = z.href;
        });
      });
    }

    // Section 04: Home 2 Game Discovery Library Filter
    initGameGridFilter('h2GamesGrid', 'h2GameSearch', 'h2GameFilters', 'h2ActiveFilterLabel', 'h2ClearGameFilters', 'h2GameEmpty');

    // Section 05: Home 2 Hardware Explorer
    const hwItems = {
      tower: {
        title: 'Dual-Chamber Tempered Glass PC Tower',
        spec: 'White Panoramic Glass • RTX GPU • DDR5 • 7 PWM RGB Fans',
        desc: 'High-airflow dual-chamber enclosures showcase liquid-cooled processors and triple-fan GPUs kept cool all day.',
        img: 'images/image-40.png'
      },
      monitor: {
        title: 'Triple-Monitor & Ultrawide Vision',
        spec: 'Synchronized BenQ Esports Displays & Super-Ultrawide Curves',
        desc: 'Choose focused 24.5"–27" tournament refresh rates or wraparound triple-monitor arrays for sims and multitasking.',
        img: 'images/image-48.png'
      },
      keyboard: {
        title: 'Hot-Swappable Mechanical Keyboards',
        spec: 'Linear Rapid-Trigger & Tactile Mechanical Switches',
        desc: 'Compact TKL layouts give maximum mousepad room for low-DPI arm aimers while keeping crisp actuation.',
        img: 'images/image-54.png'
      },
      mouse: {
        title: 'Sub-60g Precision Wireless Mice',
        spec: '26K Optical Sensor • High-Polling Receiver • Speed Desk Mats',
        desc: 'Zero-drag braided or wireless mice paired with oversized micro-woven mats for uninterrupted tracking.',
        img: 'images/image-41.png'
      },
      headset: {
        title: 'Spatial Esports Audio & Broadcast Mics',
        spec: 'Closed-Back 50mm Drivers • Noise-Cancelling Boom Mic',
        desc: 'Pinpoint footstep cues and stay cleanly heard by teammates without background room bleed.',
        img: 'images/image-54.png'
      },
      chair: {
        title: 'Ergonomic High-Back Gaming Seating',
        spec: 'Lumbar Pillow Support • 4D Armrests • Breathable Bolsters',
        desc: 'Engineered to support healthy posture across marathon 5-hour sessions and tournament qualifiers.',
        img: 'images/image-41.png'
      }
    };

    const h2HwWrap = document.getElementById('h2HardwareExplorer');
    if (h2HwWrap) {
      const hwBtns = h2HwWrap.querySelectorAll('[data-hw-key]');
      hwBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const hw = hwItems[btn.dataset.hwKey];
          if (!hw) return;
          hwBtns.forEach(b => b.classList.toggle('active', b === btn));
          document.getElementById('h2HwImg').src = hw.img;
          document.getElementById('h2HwTitle').textContent = hw.title;
          document.getElementById('h2HwSpec').textContent = hw.spec;
          document.getElementById('h2HwDesc').textContent = hw.desc;
        });
      });
    }

    // Section 07: Quick Session Booking Preview
    const previewForm = document.getElementById('h2QuickPreviewForm');
    if (previewForm) {
      const zoneSel = document.getElementById('h2PrevZone');
      const stationSel = document.getElementById('h2PrevStation');
      const dateInput = document.getElementById('h2PrevDate');
      const timeSel = document.getElementById('h2PrevTime');
      const summaryEl = document.getElementById('h2PrevSummary');
      const goBtn = document.getElementById('h2PrevGoBtn');

      if (dateInput && !dateInput.value) {
        dateInput.value = getFutureDateStr(1);
        dateInput.min = getFutureDateStr(0);
      }

      function populateStations() {
        const z = ZONES[zoneSel.value] || ZONES.standard;
        stationSel.innerHTML = z.stations.map(s => `<option value="${s.id}">${escapeHtml(s.name)} (${escapeHtml(s.row)})</option>`).join('');
        updatePreview();
      }

      function updatePreview() {
        const z = ZONES[zoneSel.value] || ZONES.standard;
        const st = stationSel.value;
        const dt = dateInput.value;
        const tm = timeSel.value;
        summaryEl.innerHTML = `
          <div><strong>Zone:</strong> ${escapeHtml(z.name)} ($${z.rate}/hr)</div>
          <div><strong>Station:</strong> ${escapeHtml(st)}</div>
          <div><strong>Date &amp; Slot:</strong> ${escapeHtml(dt)} at ${escapeHtml(tm)} (Open Seat Selection)</div>
        `;
        goBtn.href = `booking.html?zone=${encodeURIComponent(z.id)}&station=${encodeURIComponent(st)}&date=${encodeURIComponent(dt)}&slot=${encodeURIComponent(tm)}`;
      }

      zoneSel.addEventListener('change', populateStations);
      stationSel.addEventListener('change', updatePreview);
      dateInput.addEventListener('change', updatePreview);
      timeSel.addEventListener('change', updatePreview);
      populateStations();
    }
  }

  /* ========================================================================
     SHARED GAME FILTER & GAMES PAGE SPOTLIGHT
     ======================================================================== */
  function initGameGridFilter(gridId, searchId, chipsId, labelId, clearId, emptyId) {
    const grid = document.getElementById(gridId);
    if (!grid) return;

    const searchInput = document.getElementById(searchId);
    const chipsWrap = document.getElementById(chipsId);
    const labelEl = document.getElementById(labelId);
    const clearBtn = document.getElementById(clearId);
    const emptyEl = document.getElementById(emptyId);

    let activeCategory = 'All';
    let query = '';

    function applyFilter() {
      const cards = grid.querySelectorAll('[data-game-card]');
      let visibleCount = 0;

      cards.forEach(card => {
        const cat = card.getAttribute('data-category') || '';
        const title = (card.getAttribute('data-title') || '').toLowerCase();
        const catMatch = activeCategory === 'All' || cat.toLowerCase() === activeCategory.toLowerCase();
        const qMatch = !query || title.includes(query) || cat.toLowerCase().includes(query);
        const show = catMatch && qMatch;
        card.style.display = show ? '' : 'none';
        if (show) visibleCount++;
      });

      if (labelEl) {
        labelEl.textContent = `Showing ${visibleCount} game(s) • Filter: ${activeCategory}${query ? ` • Search: "${query}"` : ''}`;
      }
      if (emptyEl) {
        emptyEl.style.display = visibleCount === 0 ? 'block' : 'none';
      }
    }

    if (chipsWrap) {
      chipsWrap.querySelectorAll('[data-cat-filter]').forEach(btn => {
        btn.addEventListener('click', () => {
          activeCategory = btn.getAttribute('data-cat-filter') || 'All';
          chipsWrap.querySelectorAll('[data-cat-filter]').forEach(b => b.classList.toggle('active', b === btn));
          applyFilter();
        });
      });
    }

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        query = searchInput.value.trim().toLowerCase();
        applyFilter();
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        activeCategory = 'All';
        query = '';
        if (searchInput) searchInput.value = '';
        chipsWrap?.querySelectorAll('[data-cat-filter]').forEach((b, i) => b.classList.toggle('active', i === 0));
        applyFilter();
      });
    }

    applyFilter();
  }

  function initGamesPage() {
    initGameGridFilter('gamesLibraryGrid', 'gamesSearchInput', 'gamesCategoryChips', 'gamesActiveFilter', 'gamesClearFilters', 'gamesEmptyState');

    const spotlightWrap = document.getElementById('gameSpotlightPanel');
    if (!spotlightWrap) return;

    const spotCatalog = {
      'street-fps': {
        title: 'Street Combat Tactical FPS',
        genre: 'FPS / Competitive',
        players: '5v5 Ranked & Custom Scrims',
        zone: 'premium',
        zoneLabel: 'Premium PC Zone (360Hz OLED)',
        img: 'images/image-45.png',
        desc: 'Close-quarters street combat tuned for rapid mouse flicks, clean voice callouts, and high-frame-rate visibility.'
      },
      'scifi-fps': {
        title: 'Armored Sci-Fi Arena Shooter',
        genre: 'FPS / Sci-Fi',
        players: 'Solo / Co-Op Squad',
        zone: 'premium',
        zoneLabel: 'Premium RTX Rig',
        img: 'images/image-39.png',
        desc: 'Futuristic skyline firefights rendered with vivid particle effects and custom GPU cooling telemetry.'
      },
      'aram-moba': {
        title: 'League of Legends: ARAM & Rift',
        genre: 'MOBA / Strategy',
        players: '5v5 Team Row',
        zone: 'standard',
        zoneLabel: 'Standard PC Lounge Booth',
        img: 'images/image-24.png',
        desc: 'All-Random All-Mid bridge skirmishes and ranked Summoner Rift queues in ergonomic leatherette lounge booths.'
      },
      'fantasy-rpg': {
        title: 'Dark Fantasy Warriors RPG',
        genre: 'Adventure / RPG',
        players: 'Solo / Co-Op',
        zone: 'premium',
        zoneLabel: 'Curved Ultrawide Pod',
        img: 'images/image-46.png',
        desc: 'Expansive cinematic forest battles played across curved ultrawide displays with Discord squad sidebars.'
      },
      'ps5-hits': {
        title: 'PS5 Showcase: GT7, Spider-Man 2 & GoW',
        genre: 'Sports & Adventure',
        players: '1–2 Players Couch Lounge',
        zone: 'standard',
        zoneLabel: 'VIP Console Lounge',
        img: 'images/image-99.png',
        desc: 'Play blockbuster PlayStation 5 titles on a wall-mounted theater screen from plush illuminated lounge recliners.'
      },
      'gt-drift': {
        title: 'Drift & Circuit Simulators',
        genre: 'Racing Simulator',
        players: 'Solo / Time-Attack',
        zone: 'racing',
        zoneLabel: 'Racing Simulator Cockpit',
        img: 'images/image-98.png',
        desc: 'High-speed drift challenges and GT time trials running on force-feedback steering wheels and metal pedals.'
      },
      'combat-arena': {
        title: 'UFC & FIFA Console Clash',
        genre: 'Sports / Fighting',
        players: '1v1 Local Matchups',
        zone: 'standard',
        zoneLabel: 'Console Sofa Corner',
        img: 'images/image-37.png',
        desc: 'Head-to-head sports and combat matchups beside the RTX PC zone.'
      },
      'val-console': {
        title: 'Valorant + PS5 Hybrid Pods',
        genre: 'FPS / Multi-Platform',
        players: 'Duo / Squad',
        zone: 'team',
        zoneLabel: 'Dual-Format Arena Pod',
        img: 'images/image-66.png',
        desc: 'Switch effortlessly between tactical PC rounds and PS5 sports matches inside the same booth.'
      },
      'vr-roam': {
        title: 'Free-Roam VEX VR Arena',
        genre: 'VR Adventure',
        players: '2–4 Co-Op Players',
        zone: 'standard',
        zoneLabel: 'VR Arena Deck',
        img: 'images/image-100.png',
        desc: 'Untethered grid-tracked VR motion games with wireless controllers inside an open laser-lit playfield.'
      },
      'vr-tactical': {
        title: 'Tactical Rifle VR Shooter',
        genre: 'VR Action',
        players: '2–4 Co-Op Players',
        zone: 'premium',
        zoneLabel: 'Caged VR Tactical Bay',
        img: 'images/image-101.png',
        desc: 'Two-handed tracked rifle hardware for intense squad defense missions in dedicated VR cages.'
      }
    };

    function renderSpotlight(key) {
      const g = spotCatalog[key];
      if (!g) return;
      document.getElementById('spotGameImg').src = g.img;
      document.getElementById('spotGameImg').alt = g.title;
      document.getElementById('spotGameTitle').textContent = g.title;
      document.getElementById('spotGameGenre').textContent = g.genre;
      document.getElementById('spotGamePlayers').textContent = g.players;
      document.getElementById('spotGameZone').textContent = g.zoneLabel;
      document.getElementById('spotGameDesc').textContent = g.desc;
      document.getElementById('spotGameBook').href = `booking.html?zone=${encodeURIComponent(g.zone)}`;

      document.querySelectorAll('[data-spot-select]').forEach(el => {
        el.classList.toggle('active', el.getAttribute('data-spot-select') === key);
      });
    }

    document.addEventListener('click', (e) => {
      const trigger = e.target.closest('[data-spot-select]');
      if (!trigger) return;
      const key = trigger.getAttribute('data-spot-select');
      renderSpotlight(key);
      if (trigger.getAttribute('data-scroll-spot') === 'true') {
        spotlightWrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });

    // Check URL param ?game=
    const urlGame = new URLSearchParams(window.location.search).get('game');
    if (urlGame && spotCatalog[urlGame]) {
      renderSpotlight(urlGame);
    }
  }

  /* ========================================================================
     STATIONS PAGE & PRICING ACCORDION
     ======================================================================== */
  function initStationsPage() {
    const hwExplorer = document.getElementById('stationsHwShowcase');
    if (hwExplorer) {
      const builds = {
        rig: {
          title: 'Core Glass RGB Workstation',
          img: 'images/image-86.png',
          spec: 'Tempered Glass Mid-Tower • Custom Sleeved Cables • 360mm Airflow',
          desc: 'Dual-keyboard and headset-ready desktop build engineered for zero thermal throttling during marathon tournament brackets.',
          zoneHref: 'booking.html?zone=standard',
          ctaLabel: 'Reserve Standard PC Tier'
        },
        pod: {
          title: 'Semi-Enclosed VIP Immersion Pod',
          img: 'images/image-89.png',
          spec: 'Motorized Canopy Shell • Suspended Monitor Mount • Reclining Leather Seat',
          desc: 'Futuristic single-occupant gaming cockpit reducing ambient distraction for total immersion in RPGs or solo ranked grinds.',
          zoneHref: 'booking.html?zone=premium',
          ctaLabel: 'Reserve VIP Immersion Pod'
        },
        creator: {
          title: 'Dual-Monitor Creator & Esports Booth',
          img: 'images/image-5.png',
          spec: 'Dual AGON Displays • DSLR Camera Rig • Condenser Mic • RTX GPU',
          desc: 'Complete broadcast booth ready for live streaming, commentary, and tournament highlight capture right out of the box.',
          zoneHref: 'booking.html?zone=team',
          ctaLabel: 'Reserve Creator & Team Booth'
        }
      };

      hwExplorer.querySelectorAll('[data-station-hw]').forEach(btn => {
        btn.addEventListener('click', () => {
          const item = builds[btn.getAttribute('data-station-hw')];
          if (!item) return;
          hwExplorer.querySelectorAll('[data-station-hw]').forEach(b => b.classList.toggle('active', b === btn));
          const stImg = document.getElementById('stHwImg');
          if (stImg) stImg.src = item.img;
          document.getElementById('stHwTitle').textContent = item.title;
          document.getElementById('stHwSpec').textContent = item.spec;
          document.getElementById('stHwDesc').textContent = item.desc;
          const stBtn = document.getElementById('stHwBookBtn');
          if (stBtn) {
            stBtn.href = item.zoneHref;
            stBtn.textContent = item.ctaLabel;
          }
        });
      });
    }

    // About page philosophy switcher
    const philWrap = document.getElementById('aboutPhilosophyTabs');
    if (philWrap) {
      const pillars = {
        performance: {
          title: 'Zero Compromise Frame Rates',
          desc: 'Every bay is configured around high-refresh panels, mechanical actuation, and wired gigabit networking so hardware never holds back your skill.'
        },
        community: {
          title: 'Built For Squads & Newcomers',
          desc: 'From 5-seat bootcamp rows to casual console lounges, REDLINE ARENA brings local players together offline.'
        },
        competition: {
          title: 'Tournament-Ready Infrastructure',
          desc: 'Synchronized stage pods, live bracket boards, and clean audio routing support weekly amateur nights and seasonal cups.'
        },
        comfort: {
          title: 'Ergonomics For Long Sessions',
          desc: 'Supportive lumbar seating, adjustable desk heights, clean peripherals, and balanced acoustic zoning keep hours effortless.'
        }
      };
      philWrap.querySelectorAll('[data-pillar]').forEach(btn => {
        btn.addEventListener('click', () => {
          const p = pillars[btn.getAttribute('data-pillar')];
          if (!p) return;
          philWrap.querySelectorAll('[data-pillar]').forEach(b => b.classList.toggle('active', b === btn));
          document.getElementById('pillarTitle').textContent = p.title;
          document.getElementById('pillarDesc').textContent = p.desc;
        });
      });
    }
  }

  function initAccordion() {
    document.querySelectorAll('.faq-trigger').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = btn.closest('.faq-item');
        const expanded = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!expanded));
        item.classList.toggle('open', !expanded);
      });
    });
  }

  /* ========================================================================
     BOOKING PAGE ENGINE (ZONE -> STATION -> DATE/TIME -> VALIDATION -> DASHBOARD SYNC)
     ======================================================================== */
  function initBookingPage() {
    const bookingForm = document.getElementById('arenaBookingForm');
    if (!bookingForm) return;

    const params = new URLSearchParams(window.location.search);
    let selectedZoneId = ZONES[params.get('zone')] ? params.get('zone') : 'standard';
    let selectedStationId = params.get('station') || ZONES[selectedZoneId].stations[0].id;
    let selectedPeriod = 'all';
    let selectedSlot = params.get('slot') || '18:00';
    let selectedDuration = 2;

    const dateInput = document.getElementById('bookDate');
    const durationSelect = document.getElementById('bookDuration');
    const nameInput = document.getElementById('bookName');
    const emailInput = document.getElementById('bookEmail');
    const phoneInput = document.getElementById('bookPhone');
    const notesInput = document.getElementById('bookNotes');

    dateInput.min = getFutureDateStr(0);
    dateInput.value = params.get('date') || getFutureDateStr(1);

    if (params.get('pack') === 'power-3h') selectedDuration = 3;
    if (params.get('pack') === 'pro-5h') selectedDuration = 5;
    if (params.get('pack') === 'quick-1h') selectedDuration = 1;
    durationSelect.value = String(selectedDuration);

    // Prefill signed-in user info
    const activeUser = getCurrentUser();
    if (activeUser) {
      nameInput.value = activeUser.name || '';
      emailInput.value = activeUser.email || '';
      phoneInput.value = activeUser.phone || '';
    }

    function getBookedSlotsFor(stationId, dateStr) {
      const bookings = readStorage(STORAGE_KEYS.BOOKINGS, []);
      const taken = new Set();
      // Static demo base busy slots from ZONES
      Object.values(ZONES).forEach(z => {
        const found = z.stations.find(s => s.id === stationId);
        if (found) found.busySlots.forEach(t => taken.add(t));
      });
      // Dynamic user bookings in localStorage (non-cancelled)
      bookings.forEach(b => {
        if (b.stationId === stationId && b.date === dateStr && b.status !== 'Cancelled') {
          taken.add(b.slot);
        }
      });
      return taken;
    }

    function renderZones() {
      document.querySelectorAll('[data-book-zone]').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-book-zone') === selectedZoneId);
      });
      const z = ZONES[selectedZoneId];
      document.getElementById('zoneSpecNote').textContent = z.specSummary;
    }

    function renderStations() {
      const z = ZONES[selectedZoneId];
      const grid = document.getElementById('stationFloorGrid');
      if (!z.stations.some(s => s.id === selectedStationId)) {
        selectedStationId = z.stations[0].id;
      }

      const dateStr = dateInput.value;
      grid.innerHTML = z.stations.map(st => {
        const taken = getBookedSlotsFor(st.id, dateStr);
        const freeCount = TIME_SLOTS.length - taken.size;
        const isActive = st.id === selectedStationId;
        return `
          <button type="button" class="station-bay-btn ${isActive ? 'active' : ''}" data-select-station="${escapeHtml(st.id)}">
            <span style="font-family:var(--font-hud);font-size:0.78rem;color:var(--red);font-weight:700;">${escapeHtml(st.id)}</span>
            <strong style="font-family:var(--font-display);font-size:0.95rem;">${escapeHtml(st.name)}</strong>
            <span class="text-muted" style="font-size:0.78rem;">${escapeHtml(st.row)}</span>
            <span class="text-muted" style="font-size:0.75rem;">${freeCount} slots open</span>
          </button>
        `;
      }).join('');

      grid.querySelectorAll('[data-select-station]').forEach(btn => {
        btn.addEventListener('click', () => {
          selectedStationId = btn.getAttribute('data-select-station');
          renderStations();
          renderSlots();
          updateSummary();
        });
      });
    }

    function renderSlots() {
      const slotGrid = document.getElementById('timeSlotGrid');
      const taken = getBookedSlotsFor(selectedStationId, dateInput.value);

      const filtered = TIME_SLOTS.filter(s => selectedPeriod === 'all' || s.period === selectedPeriod);
      if (!filtered.some(s => s.time === selectedSlot && !taken.has(s.time))) {
        const firstOpen = filtered.find(s => !taken.has(s.time));
        selectedSlot = firstOpen ? firstOpen.time : '';
      }

      slotGrid.innerHTML = filtered.map(s => {
        const isTaken = taken.has(s.time);
        const isActive = s.time === selectedSlot && !isTaken;
        return `
          <button type="button" class="slot-btn ${isActive ? 'active' : ''}" data-select-slot="${s.time}" ${isTaken ? 'disabled title="Slot already reserved"' : ''}>
            ${escapeHtml(s.label)} ${isTaken ? '• Reserved' : ''}
          </button>
        `;
      }).join('');

      slotGrid.querySelectorAll('[data-select-slot]').forEach(btn => {
        btn.addEventListener('click', () => {
          selectedSlot = btn.getAttribute('data-select-slot');
          renderSlots();
          updateSummary();
        });
      });
    }

    function updateSummary() {
      const z = ZONES[selectedZoneId];
      const st = z.stations.find(s => s.id === selectedStationId) || z.stations[0];
      const slotObj = TIME_SLOTS.find(s => s.time === selectedSlot);
      const hrs = Number(durationSelect.value || 2);
      const total = z.rate * hrs;

      document.getElementById('bookStationInput').value = `${st.id} — ${z.name}`;
      document.getElementById('sumZone').textContent = z.name;
      document.getElementById('sumStation').textContent = `${st.name} (${st.row})`;
      document.getElementById('sumDate').textContent = dateInput.value || 'Select date';
      document.getElementById('sumTime').textContent = slotObj ? slotObj.label : 'No open slot selected';
      document.getElementById('sumDuration').textContent = `${hrs} Hour${hrs > 1 ? 's' : ''}`;
      document.getElementById('sumPrice').textContent = `$${total}.00 (Pay at Venue / Hour Pack)`;
    }

    document.querySelectorAll('[data-book-zone]').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedZoneId = btn.getAttribute('data-book-zone');
        selectedStationId = ZONES[selectedZoneId].stations[0].id;
        renderZones();
        renderStations();
        renderSlots();
        updateSummary();
      });
    });

    document.querySelectorAll('[data-period-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedPeriod = btn.getAttribute('data-period-filter');
        document.querySelectorAll('[data-period-filter]').forEach(b => b.classList.toggle('active', b === btn));
        renderSlots();
        updateSummary();
      });
    });

    dateInput.addEventListener('change', () => {
      renderStations();
      renderSlots();
      updateSummary();
    });

    durationSelect.addEventListener('change', updateSummary);

    bookingForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const errEl = document.getElementById('bookingFormError');
      errEl.textContent = '';

      const fullName = nameInput.value.trim();
      const email = emailInput.value.trim();
      const phone = phoneInput.value.trim();
      const notes = notesInput.value.trim();
      const dateStr = dateInput.value;
      const hrs = Number(durationSelect.value || 2);

      if (!fullName || fullName.length < 2) {
        errEl.textContent = 'Please enter your full name (at least 2 characters).';
        nameInput.focus();
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errEl.textContent = 'Please enter a valid email address.';
        emailInput.focus();
        return;
      }
      if (!phone || phone.replace(/\D/g, '').length < 7) {
        errEl.textContent = 'Please enter a valid contact phone number (at least 7 digits).';
        phoneInput.focus();
        return;
      }
      if (!dateStr) {
        errEl.textContent = 'Please select a valid booking date.';
        dateInput.focus();
        return;
      }
      if (!selectedSlot) {
        errEl.textContent = 'The chosen slot is unavailable or unselected. Please pick an open time slot.';
        return;
      }

      const taken = getBookedSlotsFor(selectedStationId, dateStr);
      if (taken.has(selectedSlot)) {
        errEl.textContent = 'This station and time slot is already reserved. Please choose another open slot.';
        renderSlots();
        return;
      }

      const z = ZONES[selectedZoneId];
      const st = z.stations.find(s => s.id === selectedStationId);
      const slotObj = TIME_SLOTS.find(s => s.time === selectedSlot);
      const refId = 'RLA-' + Math.floor(1000 + Math.random() * 8999);
      const user = getCurrentUser();

      const newBooking = {
        id: refId,
        userEmail: user ? user.email : email,
        customerName: fullName,
        customerPhone: phone,
        zone: z.id,
        zoneLabel: z.name,
        stationId: st.id,
        stationName: st.name,
        date: dateStr,
        slot: selectedSlot,
        slotLabel: slotObj ? slotObj.label : selectedSlot,
        duration: hrs,
        price: z.rate * hrs,
        notes: notes || 'Standard peripherals requested',
        status: 'Confirmed',
        sessionOwned: true,
        createdAt: new Date().toISOString()
      };

      const bookings = readStorage(STORAGE_KEYS.BOOKINGS, []);
      bookings.unshift(newBooking);
      writeStorage(STORAGE_KEYS.BOOKINGS, bookings);

      renderStations();
      renderSlots();
      updateSummary();

      const banner = document.getElementById('bookingSuccessBanner');
      if (banner) {
        banner.style.display = 'block';
        banner.innerHTML = `
          <strong>YOUR GAMING BOOKING REQUEST HAS BEEN CREATED SUCCESSFULLY.</strong>
          <div class="mt-1">Booking Reference: <code>${escapeHtml(refId)}</code> &bull; ${escapeHtml(st.name)} on ${escapeHtml(dateStr)} at ${escapeHtml(newBooking.slotLabel)} (${hrs}h).</div>
        `;
      }

      openModal(
        'Booking Request Confirmed',
        `<div class="demo-badge">Reference #${escapeHtml(refId)}</div>
         <h4 style="font-family:var(--font-display);">YOUR GAMING BOOKING REQUEST HAS BEEN CREATED SUCCESSFULLY.</h4>
         <div class="card-meta-list">
           <div><strong>Player:</strong> ${escapeHtml(fullName)} (${escapeHtml(email)})</div>
           <div><strong>Zone &amp; Station:</strong> ${escapeHtml(z.name)} — ${escapeHtml(st.name)}</div>
           <div><strong>Schedule:</strong> ${escapeHtml(dateStr)} at ${escapeHtml(newBooking.slotLabel)} (${hrs} Hours)</div>
           <div><strong>Session Total:</strong> $${z.rate * hrs}.00 (Pay at arena desk or deduct from your Hour Pack balance)</div>
         </div>`,
        `<a href="dashboard.html" class="btn btn-primary btn-sm">View in Gamer Dashboard</a>
         <button type="button" class="btn btn-secondary btn-sm" data-modal-dismiss>Book Another Slot</button>`
      );
    });

    renderZones();
    renderStations();
    renderSlots();
    updateSummary();
  }

  /* ========================================================================
     LOGIN & REGISTER PORTALS (DEMO FRONTEND AUTH — NO RAW PASSWORDS SAVED)
     ======================================================================== */
  function initAuthPages() {
    // Password toggle buttons
    document.querySelectorAll('[data-pw-toggle]').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = document.getElementById(btn.getAttribute('data-pw-toggle'));
        if (!input) return;
        const showPw = input.type === 'password';
        input.type = showPw ? 'text' : 'password';
        btn.setAttribute('aria-pressed', String(showPw));
        btn.setAttribute('aria-label', showPw ? 'Hide password' : 'Show password');
        btn.setAttribute('title', showPw ? 'Hide password' : 'Show password');
        if (!btn.querySelector('svg')) {
          btn.textContent = showPw ? 'Hide' : 'Show';
        }
      });
    });

    // Login Form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      const emailEl = document.getElementById('loginEmail');
      const pwEl = document.getElementById('loginPassword');
      const errEl = document.getElementById('loginError');

      document.getElementById('fillDemoCredsBtn')?.addEventListener('click', () => {
        emailEl.value = 'alex@redlinearena.demo';
        pwEl.value = 'RedlineDemo2026';
        errEl.textContent = '';
      });

      document.getElementById('forgotPwLink')?.addEventListener('click', (e) => {
        e.preventDefault();
        openModal(
          'Password Reset & Quick Access',
          `<p>Forgot your password? At our physical arena desk we verify your gamer tag in seconds, or you can jump straight into your Gamer Dashboard right now using our sample member profile.</p>
           <div class="card-meta-list">
             <div><strong>Member Email:</strong> <code>alex@redlinearena.demo</code></div>
             <div><strong>Password:</strong> <code>RedlineDemo2026</code></div>
           </div>`,
          `<button type="button" class="btn btn-primary btn-sm" id="modalQuickFillCredsBtn">Fill Member Credentials</button>
           <a href="register.html" class="btn btn-secondary btn-sm">Create New Account</a>`
        );
        document.getElementById('modalQuickFillCredsBtn')?.addEventListener('click', () => {
          emailEl.value = 'alex@redlinearena.demo';
          pwEl.value = 'RedlineDemo2026';
          errEl.textContent = '';
          closeModal();
        });
      });

      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        errEl.textContent = '';
        const email = emailEl.value.trim().toLowerCase();
        const pw = pwEl.value;

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          errEl.textContent = 'Please enter a valid email address.';
          return;
        }
        if (pw.length < 6) {
          errEl.textContent = 'Password must be at least 6 characters.';
          return;
        }

        const accounts = readStorage(STORAGE_KEYS.ACCOUNTS, []);
        const matched = accounts.find(a => a.email.toLowerCase() === email);
        const pwHash = hashCredentialDemo(pw);

        if (!matched || matched.authHash !== pwHash) {
          errEl.textContent = 'Email or password did not match. Try "Fill Member Credentials" or create a new member account.';
          return;
        }

        setCurrentUser(matched);
        window.location.href = 'dashboard.html';
      });
    }

    // Register Form
    const regForm = document.getElementById('registerForm');
    if (regForm) {
      const nameEl = document.getElementById('regName');
      const userEl = document.getElementById('regUsername');
      const emailEl = document.getElementById('regEmail');
      const phoneEl = document.getElementById('regPhone');
      const pwEl = document.getElementById('regPassword');
      const pw2El = document.getElementById('regConfirmPassword');
      const termsEl = document.getElementById('regTerms');
      const errEl = document.getElementById('registerError');
      const okEl = document.getElementById('registerSuccess');

      regForm.addEventListener('submit', (e) => {
        e.preventDefault();
        errEl.textContent = '';
        okEl.style.display = 'none';

        const name = nameEl.value.trim();
        const tag = userEl.value.trim();
        const email = emailEl.value.trim().toLowerCase();
        const phone = phoneEl.value.trim();
        const pw = pwEl.value;
        const pw2 = pw2El.value;

        if (name.length < 2) {
          errEl.textContent = 'Please enter your full name.';
          return;
        }
        if (!/^[a-zA-Z0-9_]{3,20}$/.test(tag)) {
          errEl.textContent = 'Gamer username must be 3–20 characters (letters, numbers, or underscores).';
          return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          errEl.textContent = 'Please enter a valid email address.';
          return;
        }
        if (phone.replace(/\D/g, '').length < 7) {
          errEl.textContent = 'Please enter a valid phone number.';
          return;
        }
        if (pw.length < 6) {
          errEl.textContent = 'Password must be at least 6 characters.';
          return;
        }
        if (pw !== pw2) {
          errEl.textContent = 'Passwords do not match.';
          return;
        }
        if (!termsEl.checked) {
          errEl.textContent = 'Please accept the arena terms to create your profile.';
          return;
        }

        const accounts = readStorage(STORAGE_KEYS.ACCOUNTS, []);
        if (accounts.some(a => a.email.toLowerCase() === email)) {
          errEl.textContent = 'An account with this email already exists. Please log in instead.';
          return;
        }

        const newUser = {
          id: 'USR-' + Math.floor(1002 + Math.random() * 8900),
          name,
          gamerTag: tag.toUpperCase(),
          email,
          phone,
          authHash: hashCredentialDemo(pw),
          preferredZone: 'standard',
          memberTier: 'Arena Member',
          availableHours: 3.0,
          totalHoursPlayed: 0,
          completedSessions: 0
        };

        accounts.push(newUser);
        writeStorage(STORAGE_KEYS.ACCOUNTS, accounts);
        setCurrentUser(newUser);

        okEl.style.display = 'block';
        okEl.textContent = 'Account created! Redirecting to your Gamer Dashboard...';
        setTimeout(() => {
          window.location.href = 'dashboard.html';
        }, 650);
      });
    }
  }

  /* ========================================================================
     GAMER DASHBOARD MODULE (DISTINCT SHELL + BOOKINGS + PACKS + CHARTS + PROFILE)
     ======================================================================== */
  function initDashboard() {
    const shell = document.getElementById('dashboardShell');
    if (!shell) return;

    const sidebar = document.getElementById('dashSidebar');
    const gate = document.getElementById('dashAuthGate');
    const workspace = document.getElementById('dashWorkspace');

    // Mobile/Tablet Dashboard Sidebar Toggle
    document.getElementById('dashSidebarOpen')?.addEventListener('click', () => {
      sidebar.classList.add('open');
    });
    document.getElementById('dashSidebarClose')?.addEventListener('click', () => {
      sidebar.classList.remove('open');
    });

    function switchDashTab(tabId) {
      if (!getCurrentUser()) {
        const accounts = readStorage(STORAGE_KEYS.ACCOUNTS, []);
        if (accounts.length) {
          setCurrentUser(accounts[0]);
          renderAll();
        }
      }
      document.querySelectorAll('[data-dash-nav]').forEach(b => {
        const isActive = b.getAttribute('data-dash-nav') === tabId;
        b.classList.toggle('active', isActive);
        if (isActive) b.setAttribute('aria-current', 'page');
        else b.removeAttribute('aria-current');
      });
      document.querySelectorAll('.dash-panel').forEach(p => {
        p.classList.toggle('active', p.id === `dashPanel-${tabId}`);
      });
      sidebar.classList.remove('open');
      window.scrollTo({ top: 0, behavior: 'instant' });
    }

    document.querySelectorAll('[data-dash-nav]').forEach(btn => {
      btn.addEventListener('click', () => switchDashTab(btn.getAttribute('data-dash-nav')));
    });

    document.querySelectorAll('[data-dash-jump]').forEach(btn => {
      btn.addEventListener('click', () => switchDashTab(btn.getAttribute('data-dash-jump')));
    });

    // Gate Actions
    document.getElementById('dashDemoEnterBtn')?.addEventListener('click', () => {
      const accounts = readStorage(STORAGE_KEYS.ACCOUNTS, []);
      if (accounts.length) {
        setCurrentUser(accounts[0]);
        renderAll();
      }
    });

    document.getElementById('dashLogoutBtn')?.addEventListener('click', () => {
      setCurrentUser(null);
      window.location.href = 'index.html';
    });

    function renderActivitySvgChart(targetId) {
      const container = document.getElementById(targetId);
      if (!container) return;
      const history = readStorage(STORAGE_KEYS.HISTORY, []);
      const recent = history.slice(0, 6).reverse();
      const maxHrs = Math.max(4, ...recent.map(r => Number(r.duration || 1)));

      const w = 520;
      const h = 190;
      const padL = 32;
      const padB = 34;
      const barW = 46;
      const gap = 30;

      const bars = recent.map((item, idx) => {
        const val = Number(item.duration || 0);
        const barH = Math.max(12, Math.round((val / maxHrs) * (h - padB - 28)));
        const x = padL + idx * (barW + gap);
        const y = h - padB - barH;
        const shortLabel = (item.stationId || 'PC').slice(0, 7);
        return `
          <g>
            <rect x="${x}" y="${y}" width="${barW}" height="${barH}" rx="4" fill="#D71932"></rect>
            <text x="${x + barW / 2}" y="${y - 6}" text-anchor="middle" font-size="11" font-weight="700" fill="currentColor">${val}h</text>
            <text x="${x + barW / 2}" y="${h - 12}" text-anchor="middle" font-size="10" fill="#A7A9B0">${escapeHtml(shortLabel)}</text>
          </g>
        `;
      }).join('');

      container.innerHTML = `
        <svg viewBox="0 0 ${w} ${h}" style="width:100%;max-width:620px;height:auto;color:var(--text-primary);" role="img" aria-label="Gaming Hours by Recent Session">
          <line x1="20" y1="${h - padB}" x2="${w - 16}" y2="${h - padB}" stroke="var(--border-strong)" stroke-width="1"/>
          ${bars}
        </svg>
      `;
    }

    function renderAll() {
      const user = getCurrentUser();
      if (!user) {
        gate.style.display = 'block';
        workspace.style.display = 'none';
        return;
      }
      gate.style.display = 'none';
      workspace.style.display = 'block';

      const bookings = readStorage(STORAGE_KEYS.BOOKINGS, []).filter(
        b => b.userEmail === user.email || b.sessionOwned
      );
      const packs = readStorage(STORAGE_KEYS.PACKS, []);
      const history = readStorage(STORAGE_KEYS.HISTORY, []);
      const payments = readStorage(STORAGE_KEYS.PAYMENTS, []);

      const upcomingCount = bookings.filter(b => b.status === 'Confirmed').length;

      document.getElementById('dashWelcomeName').textContent = `WELCOME BACK, ${user.gamerTag}.`;
      document.getElementById('dashTopUser').textContent = `${user.name} (${user.gamerTag})`;
      document.getElementById('statTotalHours').textContent = `${Number(user.totalHoursPlayed || 0).toFixed(1)}h`;
      document.getElementById('statAvailableHours').textContent = `${Number(user.availableHours || 0).toFixed(1)}h`;
      document.getElementById('statUpcomingBookings').textContent = String(upcomingCount);
      document.getElementById('statCompletedSessions').textContent = String(user.completedSessions || history.length);

      // Overview Upcoming Preview
      const nextBooking = bookings.find(b => b.status === 'Confirmed');
      const nextPreviewEl = document.getElementById('dashNextSessionPreview');
      if (nextPreviewEl) {
        nextPreviewEl.innerHTML = nextBooking
          ? `<div class="demo-badge">${escapeHtml(nextBooking.id)} &bull; ${escapeHtml(nextBooking.status)}</div>
             <h4 class="mt-2" style="font-family:var(--font-display);font-size:1.15rem;">${escapeHtml(nextBooking.stationName)} (${escapeHtml(nextBooking.zoneLabel)})</h4>
             <p class="text-muted mt-1">${escapeHtml(nextBooking.date)} at ${escapeHtml(nextBooking.slotLabel)} &bull; ${nextBooking.duration} Hours</p>
             <p class="mt-2" style="font-size:0.86rem;">Note: ${escapeHtml(nextBooking.notes)}</p>`
          : `<p class="text-muted">No upcoming confirmed bookings yet. Use "Book a PC" to reserve a station.</p>`;
      }

      // Overview Recent Activity
      const recentEl = document.getElementById('dashRecentActivity');
      if (recentEl) {
        recentEl.innerHTML = history.slice(0, 3).map(h => `
          <div style="display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--border-subtle);">
            <div>
              <strong>${escapeHtml(h.gameOrZone)}</strong>
              <div class="text-muted" style="font-size:0.8rem;">${escapeHtml(h.stationId)} &bull; ${escapeHtml(h.date)}</div>
            </div>
            <span class="demo-badge">${h.duration}h</span>
          </div>
        `).join('');
      }

      renderActivitySvgChart('dashOverviewChart');
      renderActivitySvgChart('dashHistoryChart');

      // Bookings Table
      const bookBody = document.getElementById('dashBookingsBody');
      if (bookBody) {
        bookBody.innerHTML = bookings.length ? bookings.map(b => `
          <tr>
            <td><strong>${escapeHtml(b.id)}</strong></td>
            <td>${escapeHtml(b.stationName)}</td>
            <td>${escapeHtml(b.zoneLabel)}</td>
            <td>${escapeHtml(b.date)}</td>
            <td>${escapeHtml(b.slotLabel)}</td>
            <td>${b.duration}h</td>
            <td><span class="status-pill ${b.status === 'Confirmed' ? 'confirmed' : b.status === 'Cancelled' ? 'cancelled' : 'completed'}">${escapeHtml(b.status)}</span></td>
            <td>
              <div style="display:flex;gap:6px;flex-wrap:wrap;">
                <button type="button" class="btn btn-secondary btn-sm" data-view-booking="${escapeHtml(b.id)}">Details</button>
                ${b.status === 'Confirmed' ? `<button type="button" class="btn btn-primary btn-sm" data-cancel-booking="${escapeHtml(b.id)}">Cancel</button>` : ''}
              </div>
            </td>
          </tr>
        `).join('') : `<tr><td colspan="8">No bookings found.</td></tr>`;
      }

      // Hour Packs Table / List
      const packsBody = document.getElementById('dashPacksBody');
      if (packsBody) {
        packsBody.innerHTML = packs.map(p => `
          <tr>
            <td><strong>${escapeHtml(p.name)}</strong></td>
            <td>${p.hoursPurchased}h</td>
            <td><strong>${p.hoursRemaining}h</strong></td>
            <td>${escapeHtml(p.purchaseDate)}</td>
            <td>${escapeHtml(p.expiryDate)}</td>
            <td><span class="status-pill confirmed">${escapeHtml(p.status)}</span></td>
          </tr>
        `).join('');
      }

      // Gaming History Table
      const histBody = document.getElementById('dashHistoryBody');
      if (histBody) {
        histBody.innerHTML = history.map(h => `
          <tr>
            <td><strong>${escapeHtml(h.sessionId)}</strong></td>
            <td>${escapeHtml(h.gameOrZone)}</td>
            <td>${escapeHtml(h.stationId)}</td>
            <td>${escapeHtml(h.date)}</td>
            <td>${h.duration}h</td>
            <td><span class="status-pill completed">${escapeHtml(h.status)}</span></td>
          </tr>
        `).join('');
      }

      // Payments Table
      const payBody = document.getElementById('dashPaymentsBody');
      if (payBody) {
        payBody.innerHTML = payments.map(t => `
          <tr>
            <td><strong>${escapeHtml(t.txId)}</strong></td>
            <td>${escapeHtml(t.item)}</td>
            <td>${escapeHtml(t.date)}</td>
            <td><strong>${escapeHtml(t.amount)}</strong></td>
            <td><span class="demo-badge">${escapeHtml(t.status)}</span></td>
          </tr>
        `).join('');
      }

      // Profile Form Values
      document.getElementById('profName').value = user.name || '';
      document.getElementById('profTag').value = user.gamerTag || '';
      document.getElementById('profEmail').value = user.email || '';
      document.getElementById('profPhone').value = user.phone || '';
      document.getElementById('profZone').value = user.preferredZone || 'premium';
    }

    // Cancel & View Booking Actions
    document.addEventListener('click', (e) => {
      const cancelBtn = e.target.closest('[data-cancel-booking]');
      if (cancelBtn) {
        const id = cancelBtn.getAttribute('data-cancel-booking');
        const bookings = readStorage(STORAGE_KEYS.BOOKINGS, []);
        const target = bookings.find(b => b.id === id);
        if (target && target.status === 'Confirmed') {
          target.status = 'Cancelled';
          writeStorage(STORAGE_KEYS.BOOKINGS, bookings);
          renderAll();
        }
        return;
      }

      const viewBtn = e.target.closest('[data-view-booking]');
      if (viewBtn) {
        const id = viewBtn.getAttribute('data-view-booking');
        const b = readStorage(STORAGE_KEYS.BOOKINGS, []).find(item => item.id === id);
        if (b) {
          openModal(
            `Booking ${b.id}`,
            `<div class="demo-badge">${escapeHtml(b.status)}</div>
             <div class="card-meta-list">
               <div><strong>Zone:</strong> ${escapeHtml(b.zoneLabel)}</div>
               <div><strong>Station:</strong> ${escapeHtml(b.stationName)}</div>
               <div><strong>Date &amp; Time:</strong> ${escapeHtml(b.date)} at ${escapeHtml(b.slotLabel)}</div>
               <div><strong>Duration:</strong> ${b.duration} Hours</div>
               <div><strong>Session Total:</strong> $${b.price}.00</div>
               <div><strong>Notes:</strong> ${escapeHtml(b.notes)}</div>
             </div>`,
            `<button type="button" class="btn btn-primary btn-sm" data-modal-dismiss>Close</button>`
          );
        }
      }
    });

    // Embedded Quick Book inside Dashboard
    const dashQuickBook = document.getElementById('dashQuickBookForm');
    if (dashQuickBook) {
      const zSel = document.getElementById('dashBookZone');
      const sSel = document.getElementById('dashBookStation');
      const dInp = document.getElementById('dashBookDate');
      dInp.min = getFutureDateStr(0);
      dInp.value = getFutureDateStr(2);

      function syncDashStations() {
        const z = ZONES[zSel.value] || ZONES.standard;
        sSel.innerHTML = z.stations.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
      }
      zSel.addEventListener('change', syncDashStations);
      syncDashStations();

      dashQuickBook.addEventListener('submit', (e) => {
        e.preventDefault();
        const user = getCurrentUser();
        if (!user) return;
        const z = ZONES[zSel.value];
        const st = z.stations.find(s => s.id === sSel.value);
        const slot = document.getElementById('dashBookTime').value;
        const dur = Number(document.getElementById('dashBookDuration').value || 2);
        const dt = dInp.value;

        const bookings = readStorage(STORAGE_KEYS.BOOKINGS, []);
        const overlap = bookings.some(b => b.stationId === st.id && b.date === dt && b.slot === slot && b.status !== 'Cancelled');
        const msgEl = document.getElementById('dashBookMsg');

        if (overlap) {
          msgEl.style.color = 'var(--red)';
          msgEl.textContent = 'Slot already reserved. Pick another time or station.';
          return;
        }

        const slotObj = TIME_SLOTS.find(t => t.time === slot);
        bookings.unshift({
          id: 'RLA-' + Math.floor(1000 + Math.random() * 8999),
          userEmail: user.email,
          customerName: user.name,
          customerPhone: user.phone,
          zone: z.id,
          zoneLabel: z.name,
          stationId: st.id,
          stationName: st.name,
          date: dt,
          slot,
          slotLabel: slotObj ? slotObj.label : slot,
          duration: dur,
          price: z.rate * dur,
          notes: 'Booked from Gamer Dashboard',
          status: 'Confirmed',
          sessionOwned: true,
          createdAt: new Date().toISOString()
        });
        writeStorage(STORAGE_KEYS.BOOKINGS, bookings);
        msgEl.style.color = 'var(--text-primary)';
        msgEl.textContent = 'Booking added to My Bookings!';
        renderAll();
      });
    }

    // Profile Update Form
    const profileForm = document.getElementById('dashProfileForm');
    if (profileForm) {
      profileForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const user = getCurrentUser();
        if (!user) return;
        user.name = document.getElementById('profName').value.trim() || user.name;
        user.gamerTag = (document.getElementById('profTag').value.trim() || user.gamerTag).toUpperCase();
        user.email = document.getElementById('profEmail').value.trim() || user.email;
        user.phone = document.getElementById('profPhone').value.trim() || user.phone;
        user.preferredZone = document.getElementById('profZone').value;
        setCurrentUser(user);

        const msg = document.getElementById('dashProfileMsg');
        msg.textContent = 'Profile preferences updated and saved.';
        renderAll();
      });
    }

    window.__refreshDashboard = renderAll;
    renderAll();
  }

  /* ========================================================================
     CONTACT PAGE ENQUIRY & DIRECTIONS
     ======================================================================== */
  function initContactPage() {
    const form = document.getElementById('contactEnquiryForm');
    if (form) {
      const topicParam = new URLSearchParams(window.location.search).get('topic');
      const cTypeEl = document.getElementById('cType');
      if (topicParam === 'tournament' && cTypeEl) {
        cTypeEl.value = 'events';
      }

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const err = document.getElementById('contactFormError');
        const ok = document.getElementById('contactFormSuccess');
        err.textContent = '';
        ok.style.display = 'none';

        const name = document.getElementById('cName').value.trim();
        const email = document.getElementById('cEmail').value.trim();
        const phone = document.getElementById('cPhone').value.trim();
        const type = document.getElementById('cType').value;
        const msg = document.getElementById('cMessage').value.trim();

        if (name.length < 2) { err.textContent = 'Please enter your name.'; return; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err.textContent = 'Please enter a valid email.'; return; }
        if (phone.replace(/\D/g, '').length < 7) { err.textContent = 'Please enter a valid phone number.'; return; }
        if (msg.length < 8) { err.textContent = 'Please enter a message (at least 8 characters).'; return; }

        const list = readStorage(STORAGE_KEYS.ENQUIRIES, []);
        const ref = 'ENQ-' + Math.floor(1000 + Math.random() * 8999);
        list.unshift({ ref, name, email, phone, type, msg, date: new Date().toISOString() });
        writeStorage(STORAGE_KEYS.ENQUIRIES, list);

        ok.style.display = 'block';
        ok.textContent = `Enquiry ${ref} received! Our arena desk team has saved your request.`;
        form.reset();
      });
    }

    document.getElementById('directionsModalBtn')?.addEventListener('click', () => {
      openModal(
        'Visit REDLINE ARENA — Sector 4 Venue',
        `<p><strong>Arena Address:</strong> Sector 4 Esports District, 420 Redline Boulevard</p>
         <p class="text-muted">Open daily for walk-in gaming, scheduled station reservations, and Friday tournament nights.</p>
         <div class="card-meta-list">
           <div><strong>Transit Access:</strong> 4 mins walk from Sector 4 Metro Station</div>
           <div><strong>Parking:</strong> Underground Arena Deck Level B1 (Validated for 3h+ sessions)</div>
           <div><strong>Operating Hours:</strong> Mon–Thu 10:00 AM – 12:00 AM • Fri–Sun 10:00 AM – 02:00 AM</div>
         </div>`,
        `<a href="booking.html" class="btn btn-primary btn-sm">Reserve a Station</a>
         <button type="button" class="btn btn-secondary btn-sm" data-modal-dismiss>Close</button>`
      );
    });
  }

  /* ========================================================================
     INITIALIZATION ENTRYPOINT
     ======================================================================== */
  document.addEventListener('DOMContentLoaded', () => {
    ensureDemoSeed();
    initTheme();
    initRTL();
    initNavigation();
    initAnimationsAndScroll();
    initGlobalModals();
    initAccordion();
    initHome1();
    initHome2();
    initGamesPage();
    initStationsPage();
    initBookingPage();
    initAuthPages();
    initDashboard();
    initContactPage();
  });
})();
