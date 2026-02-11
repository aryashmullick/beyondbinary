"""
Gaze Processor - Processes eye tracking data for gaze-contingent display.
Handles gaze coordinate mapping, fixation detection, and visual crowding reduction.
"""

from dataclasses import dataclass, field
from typing import Optional
import time
import math


@dataclass
class GazePoint:
    """A single gaze data point."""
    x: float
    y: float
    timestamp: float


@dataclass
class Fixation:
    """A detected fixation (sustained gaze at a location)."""
    x: float
    y: float
    duration: float  # milliseconds
    start_time: float
    end_time: float


@dataclass
class GazeRegion:
    """Region around the gaze point for display modification."""
    center_x: float
    center_y: float
    focus_radius: float       # Inner circle - fully clear
    transition_radius: float  # Transition zone
    blur_radius: float        # Outer zone - reduced crowding
    fixation_duration: float  # How long user has been looking here


@dataclass
class CrowdingReduction:
    """Parameters for reducing visual crowding around gaze point."""
    # Spacing increases for surrounding text
    letter_spacing_boost: float  # em units to add
    word_spacing_boost: float    # em units to add
    line_height_boost: float     # multiplier increase
    # Opacity reduction for non-focused areas
    periphery_opacity: float     # 0.0-1.0
    # Font size boost for fixated word
    focus_font_scale: float      # multiplier (e.g., 1.15)
    # Background highlight for fixated region
    highlight_color: str         # hex color
    highlight_opacity: float     # 0.0-1.0

    def to_dict(self) -> dict:
        return {
            "letterSpacingBoost": self.letter_spacing_boost,
            "wordSpacingBoost": self.word_spacing_boost,
            "lineHeightBoost": self.line_height_boost,
            "peripheryOpacity": self.periphery_opacity,
            "focusFontScale": self.focus_font_scale,
            "highlightColor": self.highlight_color,
            "highlightOpacity": self.highlight_opacity,
        }


class GazeProcessor:
    """
    Processes raw gaze data into actionable display modifications.
    
    Uses a fixation detection algorithm (velocity-threshold) to determine
    where the user is looking, then computes visual crowding reduction
    parameters for the gaze-contingent display.
    """

    def __init__(
        self,
        fixation_threshold_px: float = 30.0,
        fixation_min_duration_ms: float = 100.0,
        smoothing_window: int = 5,
    ):
        self.fixation_threshold = fixation_threshold_px
        self.fixation_min_duration = fixation_min_duration_ms
        self.smoothing_window = smoothing_window
        self.gaze_buffer: list[GazePoint] = []
        self.current_fixation: Optional[Fixation] = None
        self._max_buffer_size = 120  # ~2 seconds at 60Hz

    def add_gaze_point(self, x: float, y: float, timestamp: Optional[float] = None) -> Optional[GazeRegion]:
        """
        Add a new gaze point and return the current gaze region if a fixation is detected.
        """
        if timestamp is None:
            timestamp = time.time() * 1000  # ms

        point = GazePoint(x=x, y=y, timestamp=timestamp)
        self.gaze_buffer.append(point)

        # Keep buffer bounded
        if len(self.gaze_buffer) > self._max_buffer_size:
            self.gaze_buffer = self.gaze_buffer[-self._max_buffer_size:]

        # Need minimum points for processing
        if len(self.gaze_buffer) < 3:
            return None

        # Smooth the gaze data
        smoothed = self._smooth_gaze()

        # Detect fixation
        fixation = self._detect_fixation(smoothed)

        if fixation and fixation.duration >= self.fixation_min_duration:
            self.current_fixation = fixation
            return self._compute_gaze_region(fixation)

        return None

    def _smooth_gaze(self) -> list[GazePoint]:
        """Apply moving average smoothing to reduce noise."""
        window = min(self.smoothing_window, len(self.gaze_buffer))
        smoothed = []

        for i in range(len(self.gaze_buffer)):
            start = max(0, i - window // 2)
            end = min(len(self.gaze_buffer), i + window // 2 + 1)
            window_points = self.gaze_buffer[start:end]

            avg_x = sum(p.x for p in window_points) / len(window_points)
            avg_y = sum(p.y for p in window_points) / len(window_points)

            smoothed.append(GazePoint(
                x=avg_x, y=avg_y,
                timestamp=self.gaze_buffer[i].timestamp
            ))

        return smoothed

    def _detect_fixation(self, points: list[GazePoint]) -> Optional[Fixation]:
        """
        Velocity-threshold fixation detection (I-VT algorithm).
        Groups consecutive low-velocity points as fixations.
        """
        if len(points) < 2:
            return None

        # Calculate velocities
        fixation_points = []

        for i in range(1, len(points)):
            dx = points[i].x - points[i-1].x
            dy = points[i].y - points[i-1].y
            dt = max(1, points[i].timestamp - points[i-1].timestamp)

            velocity = math.sqrt(dx**2 + dy**2) / dt * 1000  # px/sec

            # If velocity is below threshold, it's part of a fixation
            if velocity < self.fixation_threshold * 30:  # ~900 px/sec threshold
                fixation_points.append(points[i])
            elif fixation_points:
                break  # End of fixation

        if not fixation_points:
            # Check if the latest points form a fixation
            recent = points[-min(10, len(points)):]
            centroid_x = sum(p.x for p in recent) / len(recent)
            centroid_y = sum(p.y for p in recent) / len(recent)

            # Check dispersion
            max_dist = max(
                math.sqrt((p.x - centroid_x)**2 + (p.y - centroid_y)**2)
                for p in recent
            )

            if max_dist <= self.fixation_threshold:
                fixation_points = recent

        if len(fixation_points) < 2:
            return None

        # Compute fixation centroid
        cx = sum(p.x for p in fixation_points) / len(fixation_points)
        cy = sum(p.y for p in fixation_points) / len(fixation_points)
        duration = fixation_points[-1].timestamp - fixation_points[0].timestamp

        return Fixation(
            x=cx, y=cy,
            duration=duration,
            start_time=fixation_points[0].timestamp,
            end_time=fixation_points[-1].timestamp,
        )

    def _compute_gaze_region(self, fixation: Fixation) -> GazeRegion:
        """
        Compute the gaze region with adaptive radii based on fixation duration.
        Longer fixations = tighter focus (user is reading carefully).
        """
        # Base radii scale with fixation duration
        duration_factor = min(1.0, fixation.duration / 500)  # Normalize to 500ms

        # Focus radius shrinks as user dwells (they're concentrating)
        focus_radius = 80 - (20 * duration_factor)  # 80px → 60px
        transition_radius = focus_radius + 60 + (20 * duration_factor)
        blur_radius = transition_radius + 100

        return GazeRegion(
            center_x=fixation.x,
            center_y=fixation.y,
            focus_radius=focus_radius,
            transition_radius=transition_radius,
            blur_radius=blur_radius,
            fixation_duration=fixation.duration,
        )

    def reset(self):
        """Reset the processor state."""
        self.gaze_buffer.clear()
        self.current_fixation = None


def compute_crowding_reduction(
    gaze_region: GazeRegion,
    intensity: str = "medium",
) -> CrowdingReduction:
    """
    Compute visual crowding reduction parameters based on gaze region.
    
    intensity: low/medium/high - how aggressively to reduce crowding
    """
    intensity_multipliers = {
        "low":    0.5,
        "medium": 1.0,
        "high":   1.5,
    }
    mult = intensity_multipliers.get(intensity, 1.0)

    # Duration factor: longer fixation = more aggressive crowding reduction
    duration_factor = min(1.0, gaze_region.fixation_duration / 800)

    return CrowdingReduction(
        letter_spacing_boost=round(0.05 * mult * (1 + duration_factor), 3),
        word_spacing_boost=round(0.12 * mult * (1 + duration_factor), 3),
        line_height_boost=round(0.15 * mult * (1 + duration_factor * 0.5), 3),
        periphery_opacity=round(max(0.3, 1.0 - 0.4 * mult * duration_factor), 2),
        focus_font_scale=round(1.0 + 0.08 * mult * duration_factor, 3),
        highlight_color="#FFF9C4",  # Warm, gentle yellow
        highlight_opacity=round(min(0.5, 0.2 * mult * (1 + duration_factor)), 2),
    )


def gaze_region_to_dict(region: GazeRegion) -> dict:
    """Convert gaze region to serializable dict."""
    return {
        "centerX": region.center_x,
        "centerY": region.center_y,
        "focusRadius": region.focus_radius,
        "transitionRadius": region.transition_radius,
        "blurRadius": region.blur_radius,
        "fixationDuration": region.fixation_duration,
    }
