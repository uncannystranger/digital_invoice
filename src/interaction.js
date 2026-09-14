// Shared, short-lived motion. No business state is involved.
export const snappy = {
  type: "spring",
  stiffness: 460,
  damping: 32,
  mass: 0.8,
};
export const buttonMotion = {
  whileHover: { y: -1 },
  whileTap: { y: 0, scale: 0.975 },
  transition: snappy,
};
export function pointerLight(event) {
  if (
    event.pointerType !== "mouse" ||
    !matchMedia("(hover: hover) and (pointer: fine)").matches ||
    matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    return;
  const rect = event.currentTarget.getBoundingClientRect();
  event.currentTarget.style.setProperty(
    "--pointer-x",
    `${event.clientX - rect.left}px`,
  );
  event.currentTarget.style.setProperty(
    "--pointer-y",
    `${event.clientY - rect.top}px`,
  );
}
