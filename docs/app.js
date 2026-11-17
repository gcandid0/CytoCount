// CytoCount Showcase Interactions
document.addEventListener('DOMContentLoaded', () => {
  // 1. Tab Switcher
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-tab');
      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPanel = document.getElementById(targetId);
      if (targetPanel) {
        targetPanel.classList.add('active');
      }
    });
  });

  // 2. Interactive Curtain Slider Widget
  const curtainContainer = document.querySelector('.curtain-container');
  if (curtainContainer) {
    const overlayWrap = curtainContainer.querySelector('.curtain-overlay-wrap');
    const overlayImg = curtainContainer.querySelector('.curtain-image-overlay');
    const handle = curtainContainer.querySelector('.curtain-handle');
    let isDragging = false;

    const updateSlider = (clientX) => {
      const rect = curtainContainer.getBoundingClientRect();
      let pos = (clientX - rect.left) / rect.width;
      pos = Math.max(0.02, Math.min(0.98, pos));
      const pct = (pos * 100).toFixed(2) + '%';
      
      if (overlayWrap) overlayWrap.style.width = pct;
      if (handle) handle.style.left = pct;
      if (overlayImg) overlayImg.style.width = rect.width + 'px';
    };

    window.addEventListener('resize', () => {
      if (overlayImg && curtainContainer) {
        overlayImg.style.width = curtainContainer.getBoundingClientRect().width + 'px';
      }
    });

    curtainContainer.addEventListener('pointerdown', (e) => {
      isDragging = true;
      curtainContainer.setPointerCapture(e.pointerId);
      updateSlider(e.clientX);
    });

    curtainContainer.addEventListener('pointermove', (e) => {
      if (isDragging) updateSlider(e.clientX);
    });

    const stopDragging = (e) => {
      if (isDragging) {
        isDragging = false;
        try { curtainContainer.releasePointerCapture(e.pointerId); } catch (_) {}
      }
    };

    curtainContainer.addEventListener('pointerup', stopDragging);
    curtainContainer.addEventListener('pointercancel', stopDragging);

    // Initial resize trigger
    setTimeout(() => {
      if (overlayImg && curtainContainer) {
        overlayImg.style.width = curtainContainer.getBoundingClientRect().width + 'px';
      }
    }, 100);
  }

  // 3. Botão Copiar BibTeX
  const copyBtn = document.getElementById('btn-copy-citation');
  const citationCode = document.getElementById('citation-code');

  if (copyBtn && citationCode) {
    copyBtn.addEventListener('click', () => {
      const text = citationCode.innerText;
      navigator.clipboard.writeText(text).then(() => {
        const originalHtml = copyBtn.innerHTML;
        copyBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00e676" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span style="color: #00e676;">Copiado</span>
        `;
        copyBtn.style.borderColor = 'rgba(0, 230, 118, 0.4)';
        setTimeout(() => {
          copyBtn.innerHTML = originalHtml;
          copyBtn.style.borderColor = '';
        }, 2200);
      }).catch(err => {
        console.error('Falha ao copiar:', err);
      });
    });
  }
});
