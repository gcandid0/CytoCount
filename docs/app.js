// CytoCount Showcase Interactions
document.addEventListener('DOMContentLoaded', () => {
  // 1. Botão de Copiar Citação BibTeX
  const copyBtn = document.getElementById('btn-copy-citation');
  const citationCode = document.getElementById('citation-code');

  if (copyBtn && citationCode) {
    copyBtn.addEventListener('click', () => {
      const text = citationCode.innerText;
      navigator.clipboard.writeText(text).then(() => {
        const originalText = copyBtn.innerText;
        copyBtn.innerText = '✓ Copiado!';
        copyBtn.style.color = '#00e676';
        copyBtn.style.borderColor = 'rgba(0, 230, 118, 0.4)';
        setTimeout(() => {
          copyBtn.innerText = originalText;
          copyBtn.style.color = '';
          copyBtn.style.borderColor = '';
        }, 2500);
      }).catch(err => {
        console.error('Falha ao copiar:', err);
      });
    });
  }

  // 2. Interactive Curtain Slider (se presente)
  const curtainContainer = document.querySelector('.interactive-curtain');
  if (curtainContainer) {
    const handle = curtainContainer.querySelector('.curtain-handle');
    const overlay = curtainContainer.querySelector('.curtain-overlay');
    let isDragging = false;

    const setPosition = (clientX) => {
      const rect = curtainContainer.getBoundingClientRect();
      let pos = (clientX - rect.left) / rect.width;
      pos = Math.max(0.05, Math.min(0.95, pos));
      const pct = (pos * 100).toFixed(2) + '%';
      if (overlay) overlay.style.width = pct;
      if (handle) handle.style.left = pct;
    };

    curtainContainer.addEventListener('pointerdown', (e) => {
      isDragging = true;
      curtainContainer.setPointerCapture(e.pointerId);
      setPosition(e.clientX);
    });

    curtainContainer.addEventListener('pointermove', (e) => {
      if (isDragging) setPosition(e.clientX);
    });

    const stopDragging = (e) => {
      if (isDragging) {
        isDragging = false;
        try { curtainContainer.releasePointerCapture(e.pointerId); } catch (_) {}
      }
    };

    curtainContainer.addEventListener('pointerup', stopDragging);
    curtainContainer.addEventListener('pointercancel', stopDragging);
  }
});
