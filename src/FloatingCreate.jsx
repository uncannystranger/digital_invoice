import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { Plus } from "lucide-react";
import { snappy, buttonMotion, pointerLight } from "./interaction";
const MotionLink = motion.create(Link);
export default function FloatingCreate({ scrollRef }) {
  const [compact, setCompact] = useState(false),
    reduce = useReducedMotion(),
    link = useRef();
  const { pathname } = useLocation();
  useEffect(() => {
    setCompact(false);
    const node = scrollRef.current;
    if (!node || reduce) return;
    let anchor = node.scrollTop,
      direction = 0,
      distance = 0,
      frame;
    const update = () => {
      const next = node.scrollTop,
        delta = next - anchor;
      anchor = next;
      if (Math.sign(delta) !== direction) {
        direction = Math.sign(delta);
        distance = 0;
      }
      distance += Math.abs(delta);
      if (next < 40) setCompact(false);
      else if (distance > 28 && document.activeElement !== link.current) {
        setCompact(direction > 0);
        distance = 0;
      }
    };
    const scroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    node.addEventListener("scroll", scroll, { passive: true });
    return () => {
      node.removeEventListener("scroll", scroll);
      cancelAnimationFrame(frame);
    };
  }, [pathname, reduce, scrollRef]);
  return (
    <MotionLink
      ref={link}
      className="fab button primary"
      to="/qaansheegyo/cusub"
      aria-label="Samee Qaansheeg"
      data-compact={compact}
      {...buttonMotion}
      onPointerMove={pointerLight}
      onFocus={() => setCompact(false)}
      animate={{ width: compact ? 54 : 174 }}
      transition={snappy}
    >
      <span className="fab-icon">
        <Plus size={20} />
      </span>
      <motion.span
        className="fab-label"
        aria-hidden="true"
        animate={{ opacity: compact ? 0 : 1 }}
        transition={{ duration: 0.14 }}
      >
        Qaansheeg
      </motion.span>
    </MotionLink>
  );
}
