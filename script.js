let activeFirestoreSubmissionsSnapshot = [];
let slotMachineAnimationTimer = null;
let currentSelectedLotteryWinnerObj = null;

const shuffleAlgorithms = [
    (arr) => [...arr].sort(() => Math.random() - 0.5), 
    (arr) => { let a = [...arr]; for(let i=a.length-1; i>0; i--) { const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }, 
    (arr) => [...arr].reverse(), 
    (arr) => { let a=[...arr], shift=Math.floor(Math.random()*a.length); return a.slice(shift).concat(a.slice(0, shift)); }, 
    (arr) => { let a=[...arr]; return a.filter((_,i)=>i%2===0).concat(a.filter((_,i)=>i%2!==0)); }, 
    (arr) => [...arr].sort(() => window.crypto.getRandomValues(new Uint32Array(1))[0] % 3 - 1), 
    (arr) => { let a=[...arr]; for(let i=0; i<a.length; i+=2){ if(a[i+1]){ [a[i], a[i+1]] = [a[i+1], a[i]]; } } return a; }, 
    (arr) => { let a=[...arr], b=[]; while(a.length) { b.push(a.splice(Math.floor(Math.random() * a.length), 1)[0]); } return b; }, 
    (arr) => [...arr].sort((a,b) => a.gameId.localeCompare(b.gameId)*(Math.random()>0.5?1:-1)), 
    (arr) => { let a=[...arr], step=3; let b=[]; for(let i=0; i<a.length; i=(i+step)%a.length){ b.push(a[i]); a.splice(i,1); if(a.length===0) break; } return b; } 
];

window.addEventListener("load", () => {
    setTimeout(() => {
        const loader = document.getElementById("global-page-loader");
        if (loader) loader.classList.add("hidden");
    }, 400);
});

window.customAlert = function(title, message, type = 'info') {
    return new Promise(resolve => {
        const overlay = document.getElementById("custom-alert-overlay");
        const titleEl = document.getElementById("custom-alert-title");
        const msgEl = document.getElementById("custom-alert-message");
        const btnContainer = document.getElementById("custom-alert-buttons");
        const iconEl = document.getElementById("custom-alert-icon");
        const boxEl = document.getElementById("custom-alert-box");

        boxEl.className = `modal-box-card custom-popup-card popup-${type}`;
        titleEl.innerText = title;
        msgEl.innerText = message;
        
        let iconSvg = '';
        if(type === 'error') iconSvg = `<svg viewBox="0 0 24 24" width="48" height="48" fill="#FF3B30"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`;
        else iconSvg = `<svg viewBox="0 0 24 24" width="48" height="48" fill="#00A8FF"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`;
        iconEl.innerHTML = iconSvg;

        btnContainer.innerHTML = `<button class="btn btn-secondary-soft btn-sm" id="popup-ok-btn" style="width:100%">UNDERSTOOD</button>`;
        overlay.classList.remove("hidden");

        document.getElementById("popup-ok-btn").onclick = () => {
            overlay.classList.add("hidden");
            resolve();
        };
    });
};

window.togglePasswordVisibility = function() {
    const pwd = document.getElementById("auth-password");
    const iconOpen = document.getElementById("eye-icon-open");
    const iconClosed = document.getElementById("eye-icon-closed");
    if(pwd.type === "password") {
        pwd.type = "text";
        iconClosed.classList.add("hidden");
        iconOpen.classList.remove("hidden");
    } else {
        pwd.type = "password";
        iconOpen.classList.add("hidden");
        iconClosed.classList.remove("hidden");
    }
}

window.verifyAdminGatewayCredentials = async function() {
    const email = document.getElementById("auth-email").value.trim();
    const pass = document.getElementById("auth-password").value;

    if (!window.FirebaseBridge || !window.FirebaseBridge.auth) return;

    try {
        await window.FirebaseBridge.setPersistence(window.FirebaseBridge.auth, window.FirebaseBridge.browserSessionPersistence);
        await window.FirebaseBridge.signInWithEmailAndPassword(window.FirebaseBridge.auth, email, pass);
        
        document.getElementById("admin-auth-overlay").classList.add("hidden");
        document.getElementById("admin-panel-view").classList.remove("hidden");

        initializeLiveStreams();
    } catch (error) {
        await customAlert("ACCESS DENIED", "INVALID GATEWAY AUTHORIZATION SIGNATURE.", "error");
    }
}

function initializeLiveStreams() {
    if (!window.FirebaseBridge) return;
    const { db, doc, collection, query, onSnapshot } = window.FirebaseBridge;

    onSnapshot(doc(db, "configuration", "livePrize"), (docSnapshot) => {
        if (docSnapshot.exists() && docSnapshot.data().imageUrl) {
            document.getElementById("home-prize-image").src = docSnapshot.data().imageUrl;
        }
    });

    onSnapshot(query(collection(db, "submissions")), (querySnapshot) => {
        activeFirestoreSubmissionsSnapshot = [];
        querySnapshot.forEach(d => {
            if(d.data().status !== "archived") activeFirestoreSubmissionsSnapshot.push({ id: d.id, ...d.data() });
        });
    });
}

window.startLotteryAlgorithm = function() {
    const approvedPool = activeFirestoreSubmissionsSnapshot.filter(u => u.status === "approved");

    if (approvedPool.length === 0) {
        customAlert("Operation Halted", "No approved players found in database records.", "error");
        return;
    }

    document.getElementById("lottery-play-btn").disabled = true;
    document.getElementById("lottery-stop-btn").disabled = false;

    const displayNode = document.getElementById("slot-id-rolling-box");
    displayNode.classList.add("rolling-active");
    displayNode.classList.add("motion-blur");

    let pool = [...approvedPool];
    let algoIndex = 0;

    slotMachineAnimationTimer = setInterval(() => {
        algoIndex = (algoIndex + 1) % 10;
        pool = shuffleAlgorithms[algoIndex](pool);
        const dummyIndex = Math.floor(Math.random() * pool.length);
        displayNode.innerText = pool[dummyIndex].gameId;
    }, 40); 
}

window.stopLotteryAlgorithm = async function() {
    clearInterval(slotMachineAnimationTimer);
    
    const displayNode = document.getElementById("slot-id-rolling-box");
    displayNode.classList.remove("rolling-active");
    displayNode.classList.remove("motion-blur");

    const approvedPool = activeFirestoreSubmissionsSnapshot.filter(u => u.status === "approved");
    let definitiveWinnerRecord = shuffleAlgorithms[1](approvedPool)[Math.floor(Math.random() * approvedPool.length)];
    currentSelectedLotteryWinnerObj = definitiveWinnerRecord;

    displayNode.innerText = definitiveWinnerRecord.gameId;

    document.getElementById("lottery-play-btn").disabled = true;
    document.getElementById("lottery-stop-btn").disabled = true;

    if (window.FirebaseBridge) {
        const { db, doc, updateDoc, addDoc, collection } = window.FirebaseBridge;
        try {
            await updateDoc(doc(db, "submissions", definitiveWinnerRecord.id), { status: "archived" });
            await addDoc(collection(db, "winnerHistory"), {
                name: definitiveWinnerRecord.name,
                age: definitiveWinnerRecord.age,
                phone: definitiveWinnerRecord.phone,
                gameId: definitiveWinnerRecord.gameId,
                wonAt: new Date().getTime()
            });
        } catch(err) { console.error(err); }
    }

    setTimeout(() => {
        launchWinnerCelebrationDisplayOverlay(definitiveWinnerRecord);
        displayNode.innerText = "READY TO SPIN";
    }, 0);

    setTimeout(() => { document.getElementById("lottery-play-btn").disabled = false; }, 3000);
}

function launchWinnerCelebrationDisplayOverlay(winnerObj) {
    document.getElementById("win-card-name").innerText = winnerObj.name;
    document.getElementById("win-card-id").innerText = winnerObj.gameId;
    
    const detailsContainer = document.getElementById("winner-admin-sensitive-data");
    detailsContainer.classList.add("hidden");
    document.getElementById("show-more-btn").innerText = "Show More";
    document.getElementById("win-card-real-age").innerText = winnerObj.age;
    document.getElementById("win-card-real-phone").innerText = winnerObj.phone;
    
    const winImg = document.getElementById("winner-card-prize-image");
    winImg.classList.add('img-loading');
    winImg.src = document.getElementById("home-prize-image").src || "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

    document.getElementById("winner-modal-overlay").classList.remove("hidden");
    triggerPremiumConfettiCascade();
}

window.toggleWinnerDetails = function() {
    const detailsContainer = document.getElementById("winner-admin-sensitive-data");
    const isHidden = detailsContainer.classList.contains("hidden");
    const toggleBtn = document.getElementById("show-more-btn");
    if (isHidden) {
        detailsContainer.classList.remove("hidden");
        toggleBtn.innerText = "Show Less";
    } else {
        detailsContainer.classList.add("hidden");
        toggleBtn.innerText = "Show More";
    }
}

window.closeWinnerCelebrationModal = function() {
    document.getElementById("winner-modal-overlay").classList.add("hidden");
    currentSelectedLotteryWinnerObj = null;
}

window.copyWinnerId = function() { copyToClipboardText(document.getElementById("win-card-id").innerText); }
window.copyWinnerPhone = function() { copyToClipboardText(document.getElementById("win-card-real-phone").innerText); }

window.copyToClipboardText = function(text) {
    if (!text || text === "READY TO SPIN") return;
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).catch(() => fallbackCopyTextToClipboard(text));
    } else { fallbackCopyTextToClipboard(text); }
}

function fallbackCopyTextToClipboard(text) {
    let textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.select();
    try { document.execCommand('copy'); } catch (err) {}
    textArea.remove();
}

function triggerPremiumConfettiCascade() {
    const duration = 3 * 1000, animationEnd = Date.now() + duration, defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 3000 };
    function randomInRange(min, max) { return Math.random() * (max - min) + min; }
    const interval = setInterval(function() {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) return clearInterval(interval);
      const particleCount = 50 * (timeLeft / duration);
      confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
      confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
    }, 250);
}
