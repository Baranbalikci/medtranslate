"""Minimal ctypes binding to libespeak-ng (shipped by the `espeakng-loader` wheel)."""
import ctypes
import espeakng_loader

_lib = None
_buf = []


def _init():
    global _lib
    if _lib:
        return _lib
    lib = ctypes.CDLL(espeakng_loader.get_library_path())
    # espeak_Initialize(output, buflength, path, options) -> sample rate
    lib.espeak_Initialize.restype = ctypes.c_int
    rate = lib.espeak_Initialize(2, 500, espeakng_loader.get_data_path().encode(), 0)  # 2 = AUDIO_OUTPUT_SYNCHRONOUS
    if rate <= 0:
        raise RuntimeError("espeak-ng init failed")
    CB = ctypes.CFUNCTYPE(ctypes.c_int, ctypes.POINTER(ctypes.c_short), ctypes.c_int, ctypes.c_void_p)

    def cb(wav, n, events):
        if wav and n > 0:
            _buf.append(ctypes.string_at(wav, n * 2))
        return 0

    lib._cb = CB(cb)  # keep reference alive
    lib.espeak_SetSynthCallback(lib._cb)
    lib.rate = rate
    _lib = lib
    return lib


def synth(text, voice, rate_wpm=165, pitch=50):
    """Return (pcm_int16_bytes, sample_rate)."""
    lib = _init()
    if lib.espeak_SetVoiceByName(voice.encode()) != 0:
        raise ValueError(f"espeak voice not found: {voice}")
    lib.espeak_SetParameter(1, rate_wpm, 0)  # espeakRATE
    lib.espeak_SetParameter(3, pitch, 0)     # espeakPITCH
    _buf.clear()
    data = text.encode("utf-8")
    # espeak_Synth(text, size, position, position_type, end_position, flags, unique_id, user_data); flags 1 = espeakCHARS_UTF8
    lib.espeak_Synth(ctypes.c_char_p(data), len(data) + 1, 0, 1, 0, 1, None, None)
    lib.espeak_Synchronize()
    return b"".join(_buf), lib.rate
