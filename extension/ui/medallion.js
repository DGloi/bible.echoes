// The draggable gilded medallion (floating action button). Distinguishes a tap
// (open/close the panel) from a drag (reposition + persist), clamps to the viewport,
// and works with pointer events (mouse + touch).

/**
 * @param {Object} o
 * @param {HTMLElement} o.host  the fixed-position shadow host (this is what moves)
 * @param {HTMLElement} o.fab   the medallion button receiving pointer events
 * @param {{x:?number,y:?number}} o.initial  saved position (px from left/top), or nulls
 * @param {() => void} o.onTap   called on a click that wasn't a drag
 * @param {() => void} o.onDrag  called continuously while dragging (e.g. reposition panel)
 * @param {(x:number,y:number) => void} o.onDrop  called once when a drag ends (persist)
 * @returns {{ place(x:number,y:number): void }}
 */
export function initMedallion({ host, fab, initial, onTap, onDrag, onDrop }) {
  function place(x, y) {
    x = Math.max(4, Math.min(window.innerWidth - 60, x));
    y = Math.max(4, Math.min(window.innerHeight - 60, y));
    host.style.left = x + "px";
    host.style.top = y + "px";
    host.style.right = "auto";
    host.style.bottom = "auto";
  }
  if (initial && initial.x != null && initial.y != null) place(initial.x, initial.y);

  let down = null;
  let dragged = false;
  fab.addEventListener("pointerdown", (e) => {
    down = { x: e.clientX, y: e.clientY, l: host.offsetLeft, t: host.offsetTop };
    dragged = false;
    fab.setPointerCapture(e.pointerId);
    fab.style.cursor = "grabbing";
  });
  fab.addEventListener("pointermove", (e) => {
    if (!down) return;
    const dx = e.clientX - down.x;
    const dy = e.clientY - down.y;
    if (Math.abs(dx) + Math.abs(dy) > 5) dragged = true;
    if (dragged) {
      place(down.l + dx, down.t + dy);
      onDrag && onDrag();
    }
  });
  fab.addEventListener("pointerup", () => {
    fab.style.cursor = "grab";
    if (!down) return;
    const wasDrag = dragged;
    down = null;
    if (wasDrag) onDrop && onDrop(host.offsetLeft, host.offsetTop);
    else onTap && onTap();
  });

  return { place };
}
