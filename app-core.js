// RakshaSetu Core - Navigation, State, Contacts
const App = {
    state: { user: null, contacts: [], logs: [], sosActive: false, walkActive: false, checkins: [], currentPage: 'dashboard' },

    init() {
        const saved = localStorage.getItem('raksha-user');
        if (saved) {
            this.state.user = JSON.parse(saved);
            this.state.contacts = JSON.parse(localStorage.getItem('raksha-contacts') || '[]');
            this.state.logs = JSON.parse(localStorage.getItem('raksha-logs') || '[]');
            document.getElementById('onboarding-overlay').style.display = 'none';
            if (document.getElementById('setting-stealth')?.checked || JSON.parse(localStorage.getItem('raksha-settings') || '{}').stealth) {
                document.getElementById('stealth-overlay').classList.add('active');
            } else { this.showApp(); }
        }
        this.loadSettings();
        this.Shake.init();
    },

    showSetup() {
        document.getElementById('onboarding-overlay').style.display = 'none';
        document.getElementById('setup-modal').classList.add('active');
    },

    completeSetup() {
        const name = document.getElementById('setup-name').value.trim();
        const email = document.getElementById('setup-email').value.trim();
        const phone = document.getElementById('setup-phone').value.trim();
        if (!name) return alert('Please enter your name');
        this.state.user = { name, email, phone };
        localStorage.setItem('raksha-user', JSON.stringify(this.state.user));
        const cn = document.getElementById('setup-c-name').value.trim();
        const cp = document.getElementById('setup-c-phone').value.trim();
        const ce = document.getElementById('setup-c-email').value.trim();
        const ct = document.getElementById('setup-c-tier').value;
        if (cn && (cp || ce)) {
            this.state.contacts.push({ id: Date.now(), name: cn, phone: cp, email: ce, tier: parseInt(ct), rel: 'Emergency', sos: true, location: ct === '1' });
            localStorage.setItem('raksha-contacts', JSON.stringify(this.state.contacts));
        }
        document.getElementById('setup-modal').classList.remove('active');
        this.showApp();
        this.addLog('Profile created', 'green');
    },

    showApp() {
        document.getElementById('app-container').style.display = 'flex';
        document.getElementById('mobile-nav').style.display = '';
        document.getElementById('sidebar-name').textContent = this.state.user?.name || 'User';
        document.getElementById('settings-name').value = this.state.user?.name || '';
        if(document.getElementById('settings-email')) document.getElementById('settings-email').value = this.state.user?.email || '';
        document.getElementById('settings-phone').value = this.state.user?.phone || '';
        this.Contacts.render();
        this.renderLogs();
        this.Map.init();
        this.populateContactSelects();
        if (navigator.geolocation) {
            navigator.geolocation.watchPosition(p => { App.currentPos = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }; }, () => {}, { enableHighAccuracy: true, timeout: 10000 });
        }
    },

    navigate(page) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById('page-' + page)?.classList.add('active');
        document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === page));
        document.querySelectorAll('.mobile-nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === page));
        this.state.currentPage = page;
        if (page === 'map') setTimeout(() => this.Map.resize(), 100);
    },

    addLog(text, color = 'blue') {
        const now = new Date();
        const time = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        this.state.logs.unshift({ text, color, time });
        if (this.state.logs.length > 20) this.state.logs.pop();
        localStorage.setItem('raksha-logs', JSON.stringify(this.state.logs));
        this.renderLogs();
    },

    renderLogs() {
        const el = document.getElementById('activity-log');
        if (!el) return;
        el.innerHTML = this.state.logs.slice(0, 8).map(l =>
            `<div class="log-item"><div class="log-dot ${l.color}"></div><span>${l.text}</span><span class="log-time">${l.time}</span></div>`
        ).join('') || '<div class="log-item"><div class="log-dot blue"></div><span>No activity yet</span><span class="log-time">--</span></div>';
    },

    populateContactSelects() {
        const opts = this.state.contacts.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        ['walk-contact', 'checkin-contact'].forEach(id => { const s = document.getElementById(id); if (s) s.innerHTML = opts || '<option>No contacts</option>'; });
    },

    Tools: {
        openPanel(name) {
            document.querySelectorAll('.tool-panel').forEach(p => p.classList.remove('active'));
            const panel = document.getElementById('panel-' + name);
            if (panel) { panel.classList.toggle('active', true); App.navigate('tools'); }
        },
        openSafeWalk() { this.openPanel('safewalk'); },
        openFakeCall() { this.openPanel('fakecall'); },
        openRecorder() { this.openPanel('recorder'); },
        openCheckin() { this.openPanel('checkin'); }
    },

    // Contacts Module
    Contacts: {
        showAddModal() { document.getElementById('add-contact-modal').classList.add('active'); },
        hideAddModal() { document.getElementById('add-contact-modal').classList.remove('active'); ['add-c-name','add-c-phone','add-c-email','add-c-rel'].forEach(id => document.getElementById(id).value = ''); },
        add() {
            const n = document.getElementById('add-c-name').value.trim();
            const p = document.getElementById('add-c-phone').value.trim();
            const e = document.getElementById('add-c-email').value.trim();
            const r = document.getElementById('add-c-rel').value.trim();
            const t = parseInt(document.getElementById('add-c-tier').value);
            if (!n) return alert('Name is required');
            if (!p && !e) return alert('Phone or email required');
            if (App.state.contacts.length >= 10) return alert('Maximum 10 contacts');
            App.state.contacts.push({ id: Date.now(), name: n, phone: p, email: e, rel: r || 'Contact', tier: t, sos: true, location: t === 1 });
            localStorage.setItem('raksha-contacts', JSON.stringify(App.state.contacts));
            this.render();
            this.hideAddModal();
            App.addLog('Contact added: ' + n, 'green');
            App.populateContactSelects();
        },
        remove(id) {
            if (!confirm('Remove this contact?')) return;
            App.state.contacts = App.state.contacts.filter(c => c.id !== id);
            localStorage.setItem('raksha-contacts', JSON.stringify(App.state.contacts));
            this.render();
            App.populateContactSelects();
        },
        render() {
            const list = document.getElementById('contacts-list');
            const none = document.getElementById('no-contacts');
            if (!App.state.contacts.length) { list.innerHTML = ''; none.classList.remove('hidden'); return; }
            none.classList.add('hidden');
            list.innerHTML = App.state.contacts.map(c => `
                <div class="contact-card">
                    <div class="contact-avatar tier${c.tier}">${c.name.charAt(0).toUpperCase()}</div>
                    <div class="contact-info">
                        <h4>${c.name} <span class="tier-badge t${c.tier}">Tier ${c.tier}</span></h4>
                        <p>${c.rel} • ${c.phone || c.email}</p>
                    </div>
                    <div class="contact-actions">
                        ${c.phone ? `<a href="tel:${c.phone}" class="btn btn-ghost btn-sm"><i class="fa-solid fa-phone"></i></a>` : ''}
                        <button class="btn btn-ghost btn-sm" onclick="App.Contacts.remove(${c.id})"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>`).join('');
        }
    },

    // Settings
    Settings: {
        save() {
            const s = {
                shake: document.getElementById('setting-shake').checked,
                voice: document.getElementById('setting-voice').checked,
                autorecord: document.getElementById('setting-autorecord').checked,
                stealth: document.getElementById('setting-stealth').checked
            };
            localStorage.setItem('raksha-settings', JSON.stringify(s));
        },
        saveProfile() {
            App.state.user.name = document.getElementById('settings-name').value.trim();
            if(document.getElementById('settings-email')) App.state.user.email = document.getElementById('settings-email').value.trim();
            App.state.user.phone = document.getElementById('settings-phone').value.trim();
            localStorage.setItem('raksha-user', JSON.stringify(App.state.user));
            document.getElementById('sidebar-name').textContent = App.state.user.name;
            App.addLog('Profile updated', 'blue');
        },
        exportData() {
            const data = { user: App.state.user, contacts: App.state.contacts, logs: App.state.logs };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'raksha-setu-backup.json'; a.click();
        },
        clearData() { if (confirm('Delete ALL data?')) { localStorage.clear(); location.reload(); } }
    },

    loadSettings() {
        const s = JSON.parse(localStorage.getItem('raksha-settings') || '{}');
        if (s.shake !== undefined) document.getElementById('setting-shake').checked = s.shake;
        if (s.voice !== undefined) document.getElementById('setting-voice').checked = s.voice;
        if (s.autorecord !== undefined) document.getElementById('setting-autorecord').checked = s.autorecord;
        if (s.stealth !== undefined) document.getElementById('setting-stealth').checked = s.stealth;
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
