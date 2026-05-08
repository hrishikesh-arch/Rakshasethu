// RakshaSetu Features - SOS, Map, SafeWalk, FakeCall, Stealth, Recorder, CheckIn, Shake

// SOS Module
App.SOS = {
    holdTimer: null, countdownTimer: null, countdownVal: 3, broadcastTimer: null,
    _tapCount: 0, _tapTimer: null,
    handleTap() {
        this._tapCount++;
        document.getElementById('sos-main-btn').style.transform = 'scale(0.92)';
        setTimeout(() => document.getElementById('sos-main-btn').style.transform = '', 150);
        if (this._tapCount === 1) {
            this._tapTimer = setTimeout(() => { this._tapCount = 0; }, 1000);
        }
        if (this._tapCount >= 2) {
            clearTimeout(this._tapTimer);
            this._tapCount = 0;
            this.trigger();
        }
    },
    trigger() {
        this.countdownVal = CONFIG.app.sosCountdownSeconds;
        document.getElementById('sos-overlay').classList.add('active');
        document.getElementById('sos-countdown-display').textContent = this.countdownVal;
        document.getElementById('sos-countdown-label').textContent = 'seconds — tap CANCEL if safe';
        document.getElementById('sos-status-list').style.display = 'none';
        this.countdownTimer = setInterval(() => {
            this.countdownVal--;
            document.getElementById('sos-countdown-display').textContent = this.countdownVal;
            if (this.countdownVal <= 0) { clearInterval(this.countdownTimer); this.activate(); }
        }, 1000);
    },
    cancel() {
        clearInterval(this.countdownTimer);
        clearInterval(this.broadcastTimer);
        document.getElementById('sos-overlay').classList.remove('active');
        const wasActive = App.state.sosActive;
        App.state.sosActive = false;
        document.getElementById('sidebar-status').className = 'status-badge status-safe';
        document.getElementById('sidebar-status').innerHTML = '<i class="fa-solid fa-circle" style="font-size:0.5rem;"></i> SECURED';
        if (App.Recorder.recording) {
            App.Recorder.stopAndDownload();
        }
        App.addLog('SOS Cancelled — User is safe', 'green');
    },
    activate() {
        App.state.sosActive = true;
        document.getElementById('sos-countdown-display').textContent = '🚨';
        document.getElementById('sos-countdown-label').textContent = 'ALERT ACTIVE';
        document.getElementById('sos-status-list').style.display = '';
        document.getElementById('sidebar-status').className = 'status-badge status-danger';
        document.getElementById('sidebar-status').innerHTML = '<i class="fa-solid fa-circle" style="font-size:0.5rem;"></i> SOS ACTIVE';
        // Vibrate SOS pattern
        if (navigator.vibrate) navigator.vibrate([100,50,100,50,100,200,300,50,300,50,300,200,100,50,100,50,100]);
        // Show location
        if (App.currentPos) {
            document.getElementById('sos-location-text').textContent = `📍 ${App.currentPos.lat.toFixed(5)}, ${App.currentPos.lng.toFixed(5)}`;
        }
        // Send email alerts
        this.sendAlerts();
        // Auto record
        const s = JSON.parse(localStorage.getItem('raksha-settings') || '{}');
        if (s.autorecord !== false) App.Recorder.start();
        // Play alarm
        this.playAlarm();
        // Broadcast location
        this.broadcastTimer = setInterval(() => this.broadcastLocation(), CONFIG.app.locationUpdateInterval);
        App.addLog('🚨 SOS ACTIVATED', 'amber');
    },
    sendAlerts() {
        const contacts = App.state.contacts.filter(c => c.sos);
        if (!contacts.length && !App.state.user.email) return;
        const pos = App.currentPos;
        const mapLink = pos ? `https://www.google.com/maps?q=${pos.lat},${pos.lng}` : 'Location unavailable';
        
        let usingMockEmail = false;

        contacts.forEach(c => {
            if (c.email && typeof emailjs !== 'undefined') {
                if (CONFIG.emailjs.publicKey !== 'YOUR_EMAILJS_PUBLIC_KEY') {
                    emailjs.send(CONFIG.emailjs.serviceId, CONFIG.emailjs.templateId, {
                        to_email: c.email, from_name: App.state.user.name,
                        message: `🚨 SOS ALERT! ${App.state.user.name} needs help!\nLocation: ${mapLink}\nTime: ${new Date().toLocaleString('en-IN')}`,
                        location_link: mapLink
                    }, CONFIG.emailjs.publicKey).catch(() => {});
                } else {
                    usingMockEmail = true;
                }
            }
            if (c.phone && typeof CONFIG.twilio !== 'undefined') {
                if (CONFIG.twilio.accountSid !== 'YOUR_TWILIO_ACCOUNT_SID') {
                    this.sendSMS(c.phone, `🚨 SOS ALERT! ${App.state.user.name} needs help! Location: ${mapLink}`);
                } else {
                    usingMockEmail = true;
                }
            }
        });
        
        // Send email to user's Gmail
        if (App.state.user.email && typeof emailjs !== 'undefined') {
            if (CONFIG.emailjs.publicKey !== 'YOUR_EMAILJS_PUBLIC_KEY') {
                emailjs.send(CONFIG.emailjs.serviceId, CONFIG.emailjs.templateId, {
                    to_email: App.state.user.email, from_name: App.state.user.name,
                    message: `🚨 SOS ACTIVATED on your device!\nLocation: ${mapLink}\nTime: ${new Date().toLocaleString('en-IN')}`,
                    location_link: mapLink
                }, CONFIG.emailjs.publicKey).catch(() => {});
            } else {
                usingMockEmail = true;
            }
        }
        
        if (usingMockEmail) {
            App.addLog(`[MOCK] Alerts sent via Email & SMS`, 'green');
            alert('EmailJS & Twilio not configured. MOCK alerts were simulated. Please add your API keys in config.js to send real emails/SMS.');
        } else {
            App.addLog(`Alerts sent via Email & SMS`, 'green');
        }
    },
    sendSMS(to, body) {
        if (!CONFIG.twilio || CONFIG.twilio.accountSid === 'YOUR_TWILIO_ACCOUNT_SID') return;
        const url = `https://api.twilio.com/2010-04-01/Accounts/${CONFIG.twilio.accountSid}/Messages.json`;
        const auth = btoa(`${CONFIG.twilio.accountSid}:${CONFIG.twilio.authToken}`);
        const data = new URLSearchParams();
        data.append('To', to);
        data.append('From', CONFIG.twilio.phoneNumber);
        data.append('Body', body);
        
        fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: data
        }).catch(e => console.error("SMS failed", e));
    },
    broadcastLocation() {
        if (!App.currentPos) return;
        // Firebase push (if configured)
        if (typeof firebase !== 'undefined' && CONFIG.firebase.apiKey !== 'YOUR_FIREBASE_API_KEY') {
            try {
                firebase.database().ref('sos/' + (App.state.user.phone || 'user')).set({
                    lat: App.currentPos.lat, lng: App.currentPos.lng,
                    name: App.state.user.name, ts: Date.now(), active: true
                });
            } catch(e) {}
        }
    },
    playAlarm() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const playTone = (freq, start, dur) => {
                const osc = ctx.createOscillator(); const gain = ctx.createGain();
                osc.connect(gain); gain.connect(ctx.destination);
                osc.frequency.value = freq; osc.type = 'square';
                gain.gain.value = 0.3;
                osc.start(ctx.currentTime + start); osc.stop(ctx.currentTime + start + dur);
            };
            for (let i = 0; i < 8; i++) { playTone(880, i * 0.5, 0.2); playTone(660, i * 0.5 + 0.25, 0.2); }
        } catch(e) {}
    }
};

// Map Module
App.Map = {
    map: null, marker: null, trail: [], polyline: null,
    init() {
        if (this.map) return;
        try {
            this.map = L.map('map-container').setView([20.5937, 78.9629], 5);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap', maxZoom: 19
            }).addTo(this.map);
            if (App.currentPos) this.update();
            setInterval(() => this.update(), 5000);
        } catch(e) {}
    },
    update() {
        if (!App.currentPos || !this.map) return;
        const { lat, lng } = App.currentPos;
        if (!this.marker) {
            this.marker = L.circleMarker([lat, lng], { radius: 8, fillColor: App.state.sosActive ? '#FF3B5C' : '#7C5CFC', fillOpacity: 1, color: '#fff', weight: 2 }).addTo(this.map);
            this.map.setView([lat, lng], 15);
        } else { this.marker.setLatLng([lat, lng]); }
        this.trail.push([lat, lng]);
        if (this.trail.length > 100) this.trail.shift();
        if (this.polyline) this.map.removeLayer(this.polyline);
        this.polyline = L.polyline(this.trail, { color: '#7C5CFC', weight: 3, opacity: 0.6 }).addTo(this.map);
    },
    centerOnUser() { if (App.currentPos && this.map) this.map.setView([App.currentPos.lat, App.currentPos.lng], 16); },
    shareLocation() {
        if (!App.currentPos) return alert('Location not available yet');
        const link = `https://www.google.com/maps?q=${App.currentPos.lat},${App.currentPos.lng}`;
        if (navigator.clipboard) { navigator.clipboard.writeText(link); alert('Location link copied!'); }
        else { prompt('Copy this link:', link); }
        App.addLog('Location shared', 'blue');
    },
    resize() { if (this.map) setTimeout(() => this.map.invalidateSize(), 200); }
};

// Safe Walk
App.SafeWalk = {
    timer: null, endTime: null,
    start() {
        const dest = document.getElementById('walk-dest').value.trim();
        const eta = parseInt(document.getElementById('walk-eta').value);
        if (!dest || !eta) return alert('Enter destination and ETA');
        this.endTime = Date.now() + eta * 60000;
        document.getElementById('walk-dest-text').textContent = 'To: ' + dest;
        document.getElementById('safe-walk-bar').classList.add('active');
        App.state.walkActive = true;
        this.timer = setInterval(() => this.tick(), 1000);
        App.addLog('Safe Walk started → ' + dest, 'green');
        document.querySelectorAll('.tool-panel').forEach(p => p.classList.remove('active'));
    },
    tick() {
        const rem = this.endTime - Date.now();
        if (rem <= 0) { this.timeout(); return; }
        const m = Math.floor(rem / 60000); const s = Math.floor((rem % 60000) / 1000);
        document.getElementById('walk-timer-display').textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    },
    checkIn() {
        clearInterval(this.timer);
        document.getElementById('safe-walk-bar').classList.remove('active');
        App.state.walkActive = false;
        App.addLog('Safe Walk — Arrived safely ✓', 'green');
    },
    stop() { this.checkIn(); },
    timeout() {
        clearInterval(this.timer);
        App.addLog('⚠️ Safe Walk — No check-in! Triggering SOS', 'amber');
        App.SOS.trigger();
    }
};

// Fake Call
App.FakeCall = {
    timer: null,
    schedule() {
        const name = document.getElementById('fake-caller').value || 'Unknown';
        const delay = parseInt(document.getElementById('fake-delay').value) * 1000;
        App.addLog('Fake call scheduled: ' + name, 'blue');
        document.querySelectorAll('.tool-panel').forEach(p => p.classList.remove('active'));
        this.timer = setTimeout(() => this.ring(name), delay);
    },
    ring(name) {
        document.getElementById('fake-call-name-display').textContent = name;
        document.getElementById('fake-call-avatar-display').innerHTML = name.charAt(0).toUpperCase();
        document.getElementById('fake-call-status').textContent = 'Incoming Call...';
        document.getElementById('fake-call-overlay').classList.add('active');
        if (navigator.vibrate) navigator.vibrate([500, 200, 500, 200, 500]);
        try {
            const ctx = new AudioContext();
            const playRing = (t) => { const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.frequency.value = 440; g.gain.value = 0.15; o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.8); };
            for (let i = 0; i < 6; i++) playRing(i * 2);
        } catch(e) {}
    },
    answer() {
        document.getElementById('fake-call-status').textContent = 'Connected — 00:00';
        document.getElementById('btn-accept-call').style.display = 'none';
        let sec = 0;
        const t = setInterval(() => { sec++; document.getElementById('fake-call-status').textContent = `Connected — ${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`; }, 1000);
        document.getElementById('btn-decline-call').onclick = () => { clearInterval(t); this.decline(); };
    },
    decline() {
        document.getElementById('fake-call-overlay').classList.remove('active');
        document.getElementById('btn-accept-call').style.display = '';
        document.getElementById('btn-decline-call').onclick = () => App.FakeCall.decline();
        if (navigator.vibrate) navigator.vibrate(0);
    }
};

// Stealth Calculator
App.Stealth = {
    display: '0', buffer: '',
    press(key) {
        if (key === 'AC') { this.display = '0'; this.buffer = ''; }
        else if (key === '=') {
            // Check secret codes
            if (this.buffer === CONFIG.app.stealthCode) { document.getElementById('stealth-overlay').classList.remove('active'); App.SOS.trigger(); this.display = '0'; this.buffer = ''; }
            else if (this.buffer === CONFIG.app.stealthUnlockCode) { document.getElementById('stealth-overlay').classList.remove('active'); App.showApp(); this.display = '0'; this.buffer = ''; }
            else {
                try { this.display = String(eval(this.display.replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-'))); } catch(e) { this.display = 'Error'; }
                this.buffer = '';
            }
        } else if (key === '±') { this.display = String(-parseFloat(this.display) || 0); }
        else if (key === '%') { this.display = String(parseFloat(this.display) / 100); }
        else {
            if ('0123456789'.includes(key)) this.buffer += key;
            else this.buffer = '';
            if (this.display === '0' && '0123456789'.includes(key)) this.display = key;
            else this.display += key;
        }
        document.getElementById('calc-display').textContent = this.display;
    }
};

// Audio Recorder
App.Recorder = {
    mediaRecorder: null, chunks: [], recording: false, startTime: null, timerInterval: null,
    _shouldDownload: false,
    async start() {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                alert('Microphone access is not supported by your browser or requires HTTPS.');
                return;
            }
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            // Pick a supported MIME type for best playback compatibility
            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
                : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus') ? 'audio/ogg;codecs=opus'
                : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '';
            this.mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
            this.chunks = [];
            this._shouldDownload = false;
            this.mediaRecorder.ondataavailable = e => { if (e.data.size > 0) this.chunks.push(e.data); };
            this.mediaRecorder.onstop = () => this.save();
            this.mediaRecorder.start(1000);
            this.recording = true;
            this.startTime = Date.now();
            document.getElementById('recording-indicator').classList.add('active');
            this.timerInterval = setInterval(() => {
                const s = Math.floor((Date.now() - this.startTime) / 1000);
                document.getElementById('rec-timer').textContent = `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
            }, 1000);
            App.addLog('Audio recording started', 'amber');
        } catch(e) { 
            console.error(e);
            alert('Microphone access denied or an error occurred: ' + e.message); 
        }
    },
    stop() {
        if (this.mediaRecorder && this.recording && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
            this.mediaRecorder.stream.getTracks().forEach(t => t.stop());
            this.recording = false;
            clearInterval(this.timerInterval);
            document.getElementById('recording-indicator').classList.remove('active');
        }
    },
    stopAndDownload() {
        this._shouldDownload = true;
        this.stop();
    },
    save() {
        const mime = this.mediaRecorder?.mimeType || 'audio/webm';
        const ext = mime.includes('mp4') ? 'mp4' : mime.includes('ogg') ? 'ogg' : 'webm';
        const blob = new Blob(this.chunks, { type: mime });
        const url = URL.createObjectURL(blob);
        const ts = Date.now();
        const time = new Date().toLocaleString('en-IN');
        const fileName = `RakshaSetu-SOS-Recording-${ts}.${ext}`;
        // Add to recordings list with inline player
        const list = document.getElementById('recordings-list');
        list.innerHTML = `<div style="background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:var(--radius);padding:1rem;margin-bottom:0.75rem;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem;">
                <span style="font-weight:600;font-size:0.9rem;">🎙️ ${time}</span>
                <a href="${url}" download="${fileName}" class="btn btn-primary btn-sm"><i class="fa-solid fa-download"></i> Download</a>
            </div>
            <audio controls style="width:100%;height:40px;border-radius:8px;" src="${url}"></audio>
        </div>` + list.innerHTML;
        App.addLog('Recording saved — ready to play/download', 'green');
        // Auto-trigger download if SOS just ended
        if (this._shouldDownload) {
            this._shouldDownload = false;
            const a = document.createElement('a');
            document.body.appendChild(a);
            a.style = "display: none";
            a.href = url; a.download = fileName; a.click();
            document.body.removeChild(a);
            App.addLog('Recording downloaded to device', 'green');
            // Navigate to tools > recorder so user can see/play it
            App.navigate('tools');
            App.Tools.openRecorder();
        }
    }
};

// Safety Check-In
App.CheckIn = {
    timers: [],
    schedule() {
        const timeVal = document.getElementById('checkin-time').value;
        if (!timeVal) return alert('Please select a time');
        const [h, m] = timeVal.split(':').map(Number);
        const now = new Date();
        const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
        if (target <= now) target.setDate(target.getDate() + 1);
        const delay = target - now;
        const contact = document.getElementById('checkin-contact').value;
        const contactName = App.state.contacts.find(c => c.id == contact)?.name || 'Contact';
        const id = Date.now();
        const timer = setTimeout(() => this.prompt(id), delay);
        this.timers.push({ id, timer, time: timeVal, contact: contactName });
        this.renderActive();
        App.addLog(`Check-in set for ${timeVal} → ${contactName}`, 'blue');
        document.querySelectorAll('.tool-panel').forEach(p => p.classList.remove('active'));
    },
    prompt(id) {
        document.getElementById('checkin-prompt').classList.add('active');
        if (navigator.vibrate) navigator.vibrate([300, 100, 300]);
        // Escalation after grace period
        setTimeout(() => {
            if (document.getElementById('checkin-prompt').classList.contains('active')) {
                App.addLog('⚠️ Check-in missed! Alerting contacts', 'amber');
                App.SOS.sendAlerts();
            }
        }, CONFIG.app.checkInGracePeriod);
    },
    confirmSafe() {
        document.getElementById('checkin-prompt').classList.remove('active');
        App.addLog('Check-in confirmed — Safe ✓', 'green');
    },
    renderActive() {
        const el = document.getElementById('active-checkins');
        el.innerHTML = this.timers.map(t =>
            `<div class="log-item"><div class="log-dot green"></div><span>${t.time} → ${t.contact}</span><span class="log-time">⏳</span></div>`
        ).join('');
    }
};

// Shake Detection
App.Shake = {
    lastX: 0, lastY: 0, lastZ: 0, lastTime: 0,
    init() {
        window.addEventListener('devicemotion', (e) => {
            const s = JSON.parse(localStorage.getItem('raksha-settings') || '{}');
            if (s.shake === false) return;
            const a = e.accelerationIncludingGravity; if (!a) return;
            const now = Date.now();
            if (now - this.lastTime < 1000) return;
            const dx = Math.abs(a.x - this.lastX), dy = Math.abs(a.y - this.lastY), dz = Math.abs(a.z - this.lastZ);
            if (dx + dy + dz > (CONFIG.app.shakeThreshold || 30)) {
                this.lastTime = now;
                if (!App.state.sosActive) App.SOS.trigger();
            }
            this.lastX = a.x; this.lastY = a.y; this.lastZ = a.z;
        });
    }
};

App.currentPos = null;
