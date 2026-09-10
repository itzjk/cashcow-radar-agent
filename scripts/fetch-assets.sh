#!/bin/sh
# Downloads the binary model files that are not stored in this repo.
# Every file is checked against the SHA-256 of the build this code was released from.
set -e

cd "$(dirname "$0")/.."

sha() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | cut -d' ' -f1
  else shasum -a 256 "$1" | cut -d' ' -f1; fi
}

get() {
  url="$1"; out="$2"; want="$3"
  if [ -f "$out" ] && [ "$(sha "$out")" = "$want" ]; then
    echo "ok      $out"
    return 0
  fi
  mkdir -p "$(dirname "$out")"
  echo "fetch   $out"
  curl -fsSL --retry 3 -o "$out" "$url"
  got=$(sha "$out")
  if [ "$got" != "$want" ]; then
    echo "MISMATCH $out" >&2
    echo "  expected $want" >&2
    echo "  got      $got" >&2
    rm -f "$out"
    exit 1
  fi
  echo "ok      $out"
}

ORT="https://cdn.jsdelivr.net/npm/onnxruntime-web@1.14.0/dist"
HF="https://huggingface.co/Xenova/whisper-tiny/resolve/main/onnx"

get "$ORT/ort-wasm.wasm" \
    "lib/whisper/ort-wasm.wasm" \
    "bbdcb6b3c7d294577d806077630460be4e13ca35a345acb5e81188e9649fa74a"

get "$ORT/ort-wasm-simd.wasm" \
    "lib/whisper/ort-wasm-simd.wasm" \
    "9bd07bababc65f53d061f457233eeae501be7ceb8a2adb9eef52d87fe776d865"

get "$HF/encoder_model_quantized.onnx" \
    "lib/whisper/models/Xenova/whisper-tiny/onnx/encoder_model_quantized.onnx" \
    "fd9d995b9dcb0520f0dbf6cf68651af639fc385f594d9d876e69ca2802dc438e"

get "$HF/decoder_model_merged_quantized.onnx" \
    "lib/whisper/models/Xenova/whisper-tiny/onnx/decoder_model_merged_quantized.onnx" \
    "6c0c125986b007d2e3734bec84c18bda0152071b90b87fadac6d7764499927a0"

echo
echo "All assets in place. Load the folder in chrome://extensions."
