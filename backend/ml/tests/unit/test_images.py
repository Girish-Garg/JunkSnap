from io import BytesIO
from pathlib import Path

import numpy as np
import pytest
from fakes import (
    JPEG,
    FakeFitter,
    FakeImages,
    FakeSignal,
    FixedClock,
    provider_error,
    scripted_judge,
)
from PIL import Image

from ml.adapters.local_images import LocalBlurredImageStore
from ml.adapters.pillow_fitter import MAX_BYTES, MAX_SIDE, PillowImageFitter
from ml.domain.case import VerifyInput
from ml.domain.errors import InvalidImageError, NotBlurredImageError
from ml.domain.images import BlurredImage
from ml.domain.verification import CaseFeatures, Claim, Thresholds
from ml.handlers.verify_cli import main
from ml.services.combiner import FixedWeightCombiner
from ml.services.stacked_verifier import StackedVerifier
from ml.services.verify_service import VerifyService

KEY = "media/reports/rpt_jdh_1.jpg"


def encoded(picture: Image.Image, image_format: str) -> bytes:
    buffer = BytesIO()
    picture.save(buffer, format=image_format)
    return buffer.getvalue()


def test_blurred_image_refuses_anything_outside_media() -> None:
    with pytest.raises(NotBlurredImageError):
        BlurredImage("local-test/photo.jpg", JPEG)


def test_small_jpeg_passes_unchanged() -> None:
    image = BlurredImage(KEY, encoded(Image.new("RGB", (640, 480), "gray"), "JPEG"))

    assert PillowImageFitter().fit(image) is image


def test_large_image_is_downscaled_to_jpeg() -> None:
    image = BlurredImage(KEY, encoded(Image.new("RGB", (4000, 1000), "gray"), "PNG"))

    fitted = PillowImageFitter().fit(image)

    with Image.open(BytesIO(fitted.data)) as picture:
        assert (picture.format, max(picture.size)) == ("JPEG", MAX_SIDE)
    assert fitted.source == KEY


def test_heavy_image_steps_quality_down_under_the_byte_limit() -> None:
    noise = np.random.default_rng(7).integers(0, 255, (MAX_SIDE, MAX_SIDE, 3), dtype=np.uint8)
    image = BlurredImage(KEY, encoded(Image.fromarray(noise), "PNG"))
    assert len(image.data) > MAX_BYTES

    assert len(PillowImageFitter().fit(image).data) < MAX_BYTES


def test_bytes_that_are_not_an_image_are_invalid() -> None:
    with pytest.raises(InvalidImageError):
        PillowImageFitter().fit(BlurredImage(KEY, JPEG))


def test_local_store_serves_only_vouched_files(tmp_path: Path) -> None:
    photo = tmp_path / "dump.jpg"
    photo.write_bytes(JPEG)
    key = LocalBlurredImageStore.key_for(1, photo)
    store = LocalBlurredImageStore({key: photo})

    assert store.read(key).data == JPEG
    assert key.startswith("media/")
    with pytest.raises(NotBlurredImageError):
        store.read("media/local-test/02_other.jpg")


def test_service_fits_the_photo_before_verifying() -> None:
    fitter = FakeFitter()
    verifier = StackedVerifier(
        [FakeSignal("rekognition_labels", 0.95)],
        scripted_judge(provider_error())[0],
        FixedWeightCombiner(Thresholds()),
        FixedClock(),
    )
    request = VerifyInput("rpt_jdh_1", "report", KEY, Claim("waste_dump", "roadside"),
                          CaseFeatures(5, 0.5, 0))

    VerifyService(FakeImages(), fitter, verifier).verify(request)

    assert fitter.fitted == [KEY]


def test_cli_refuses_photos_not_vouched_as_blurred(capsys: pytest.CaptureFixture[str]) -> None:
    with pytest.raises(SystemExit) as stop:
        main(["photo.jpg"])

    assert stop.value.code == 2
    assert "--photos-are-blurred" in capsys.readouterr().err
