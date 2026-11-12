import React, { useEffect, useRef, useState } from 'react';

// Camp numèric de les calculadores. El text s'edita lliurement (buidar-lo, escriure
// «30» xifra a xifra, coma decimal) i el valor només es propaga quan és un número
// dins del rang; en sortir del camp es corregeix al rang. Abans es tallava a cada
// tecla («3» → mínim 10, «100» → màxim 50) i el resultat sortia d'un altre valor.
interface Props
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'min' | 'max' | 'type' | 'step'> {
  value: number;
  min: number;
  max: number;
  onValueChange: (value: number) => void;
}

const toText = (n: number) => String(n).replace('.', ',');
const parse = (text: string) => (text.trim() === '' ? NaN : Number(text.trim().replace(',', '.')));

export default function NumberInput({ value, min, max, onValueChange, onFocus, onBlur, ...rest }: Props) {
  const [text, setText] = useState(toText(value));
  const editing = useRef(false);

  // Si el valor canvia des de fora (el control lliscant), el camp el mostra; mentre
  // s'escriu, no se li toca el text.
  useEffect(() => {
    if (!editing.current) setText(toText(value));
  }, [value]);

  const n = parse(text);
  const valid = Number.isFinite(n) && n >= min && n <= max;

  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={text}
      aria-invalid={!valid}
      onFocus={(e) => {
        editing.current = true;
        onFocus?.(e);
      }}
      onChange={(e) => {
        setText(e.target.value);
        const next = parse(e.target.value);
        if (Number.isFinite(next) && next >= min && next <= max) onValueChange(next);
      }}
      onBlur={(e) => {
        editing.current = false;
        const fixed = Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : value;
        if (fixed !== value) onValueChange(fixed);
        setText(toText(fixed));
        onBlur?.(e);
      }}
    />
  );
}
