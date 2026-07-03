import React from 'react';
import {
  METRONOME_PATTERN_SHAPES,
  PATTERN_BASELINE_Y,
  PATTERN_BEAM_HEIGHT,
  PATTERN_HEAD_ROTATE_DEG,
  PATTERN_HEAD_RX,
  PATTERN_HEAD_RY,
  PATTERN_SIXTEENTH_BEAM_GAP,
  PATTERN_SIXTEENTH_BEAM_HEIGHT,
  PATTERN_STEM_TOP_Y,
  PATTERN_STROKE,
  PATTERN_TRIPLET_Y,
  PATTERN_VIEWBOX_HEIGHT,
  PATTERN_VIEWBOX_WIDTH,
  patternBeamX,
  patternFlagPath,
  patternTripletBracketX,
} from '@pianel/core/helpers/metronomePatterns';
import type { PatternShape } from '@pianel/core/types/metronomePatterns';

interface PatternGlyphProps {
  shape: PatternShape;
  className?: string;
}

export function PatternGlyph({ shape, className }: PatternGlyphProps) {
  const { x: beamX, width: beamW } = patternBeamX(shape);
  const triplet = shape.triplet ? patternTripletBracketX(shape) : null;
  const tripletMid = triplet ? (triplet.x1 + triplet.x2) / 2 : 0;

  return (
    <svg
      viewBox={`0 0 ${PATTERN_VIEWBOX_WIDTH} ${PATTERN_VIEWBOX_HEIGHT}`}
      className={className}
      aria-hidden="true"
    >
      {shape.notes.map((note, i) => (
        <g key={i}>
          <ellipse
            cx={note.head}
            cy={PATTERN_BASELINE_Y}
            rx={PATTERN_HEAD_RX}
            ry={PATTERN_HEAD_RY}
            transform={`rotate(${PATTERN_HEAD_ROTATE_DEG} ${note.head} ${PATTERN_BASELINE_Y})`}
            fill="currentColor"
          />
          <line
            x1={note.stem}
            y1={PATTERN_BASELINE_Y - 0.5}
            x2={note.stem}
            y2={PATTERN_STEM_TOP_Y}
            stroke="currentColor"
            strokeWidth={PATTERN_STROKE}
            strokeLinecap="round"
          />
          {note.flag && (
            <path
              d={patternFlagPath(note.stem)}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinecap="round"
            />
          )}
          {note.dot && (
            <circle
              cx={note.head + PATTERN_HEAD_RX + 3}
              cy={PATTERN_BASELINE_Y - 1.5}
              r={1.2}
              fill="currentColor"
            />
          )}
        </g>
      ))}

      {shape.beams >= 1 && (
        <rect
          x={beamX}
          y={PATTERN_STEM_TOP_Y - 1}
          width={beamW}
          height={shape.beams === 2 ? PATTERN_SIXTEENTH_BEAM_HEIGHT : PATTERN_BEAM_HEIGHT}
          fill="currentColor"
        />
      )}
      {shape.beams === 2 && (
        <rect
          x={beamX}
          y={PATTERN_STEM_TOP_Y - 1 + PATTERN_SIXTEENTH_BEAM_GAP}
          width={beamW}
          height={PATTERN_SIXTEENTH_BEAM_HEIGHT}
          fill="currentColor"
        />
      )}

      {triplet && (
        <g>
          <line
            x1={triplet.x1}
            y1={PATTERN_TRIPLET_Y}
            x2={tripletMid - 2.5}
            y2={PATTERN_TRIPLET_Y}
            stroke="currentColor"
            strokeWidth={0.8}
            strokeLinecap="round"
          />
          <line
            x1={tripletMid + 2.5}
            y1={PATTERN_TRIPLET_Y}
            x2={triplet.x2}
            y2={PATTERN_TRIPLET_Y}
            stroke="currentColor"
            strokeWidth={0.8}
            strokeLinecap="round"
          />
          <text
            x={tripletMid}
            y={PATTERN_TRIPLET_Y + 1.6}
            fontSize="6"
            textAnchor="middle"
            fill="currentColor"
            fontFamily="ui-monospace, monospace"
          >
            3
          </text>
        </g>
      )}
    </svg>
  );
}

export { METRONOME_PATTERN_SHAPES };
