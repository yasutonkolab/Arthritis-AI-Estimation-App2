.PHONY: test infer infer-docker

test:
	MPLCONFIGDIR=/private/tmp/ra-mpl .venv/bin/python -m pytest -q

IMAGE ?= test_images/sample_001.jpg

infer:
	MPLCONFIGDIR=/private/tmp/ra-mpl .venv/bin/python scripts/infer-local.py "$(IMAGE)"

infer-docker:
	docker build --platform linux/amd64 -t ra-inference-api:local .
	docker run --rm --platform linux/amd64 -v "$(CURDIR):/workspace:ro" -v "$(dir $(abspath $(IMAGE))):/input:ro" -w /workspace ra-inference-api:local python scripts/infer-local.py "/input/$(notdir $(IMAGE))"
