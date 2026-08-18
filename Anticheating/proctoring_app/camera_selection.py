from __future__ import annotations


class CameraSelectionError(RuntimeError):
    pass


def select_camera_index(
    descriptions: list[str],
    requested_index: int,
    preferred_name: str,
    blocked_terms: list[str],
) -> tuple[int, str]:
    """Choose a permitted camera without ever falling back to a blocked device."""
    if not descriptions:
        return requested_index, f"Camera {requested_index}"

    blocked = tuple(term.casefold() for term in blocked_terms if term.strip())

    def permitted(name: str) -> bool:
        normalized = name.casefold()
        return not any(term in normalized for term in blocked)

    allowed = [(index, name) for index, name in enumerate(descriptions) if permitted(name)]
    if not allowed:
        device_list = ", ".join(descriptions)
        raise CameraSelectionError(
            f"No permitted camera is available. Blocked devices: {device_list}. "
            "Connect or enable the built-in camera."
        )

    preferred = preferred_name.strip().casefold()
    if preferred:
        for index, name in allowed:
            if preferred in name.casefold():
                return index, name

    for index, name in allowed:
        if index == requested_index:
            return index, name
    return allowed[0]
