"""Regenerate B.I.T.'s offline English voice. Requires espeak-ng and ffmpeg."""
import ast
import re
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'apps/web/public/assets/audio/bit/en'
CATALOG = ROOT / 'apps/web/src/game/guide/catalog.ts'
PATTERN = r'''(\w+):\s*\{\s*text:\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')'''


def main():
    lines = re.findall(PATTERN, CATALOG.read_text())
    if not lines:
        raise RuntimeError('No dialogue found in the catalog')
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for name, literal in lines:
        with tempfile.TemporaryDirectory() as tmp:
            wav = Path(tmp) / 'voice.wav'
            subprocess.run([
                'espeak-ng', '-v', 'en-us+f3', '-s', '155', '-p', '62', '-a', '145',
                '-w', str(wav), ast.literal_eval(literal),
            ], check=True)
            subprocess.run([
                'ffmpeg', '-v', 'error', '-y', '-i', str(wav),
                '-af', 'highpass=f=100,lowpass=f=8500', '-codec:a', 'libmp3lame',
                '-b:a', '64k', str(OUTPUT / f'{name}.mp3'),
            ], check=True)
    print(f'Generated {len(lines)} English voice clips')


if __name__ == '__main__':
    main()
