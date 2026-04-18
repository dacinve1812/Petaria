const DEFAULT_BANNER_COUNT = 12;
const BANNER_FILE_PREFIX = 'banner';
const DEFAULT_FRACTION_COUNT = 15;
const FRACTION_FILE_PREFIX = 'fraction';
const DEFAULT_BANNER_PAD = 2;
const VISUAL_VALUE_SEPARATOR = '::';
export const FRACTION_NONE_ID = 'none';
const FRACTION_TOP_PERCENT = (280 / 900) * 100;
const FRACTION_SCALE = (375/600)

const bannerCount = Math.max(1, Number(process.env.REACT_APP_GUILD_BANNER_COUNT || DEFAULT_BANNER_COUNT));
const fractionCount = Math.max(
  1,
  Number(process.env.REACT_APP_GUILD_FRACTION_COUNT || DEFAULT_FRACTION_COUNT)
);
const bannerPad = Math.max(1, Number(process.env.REACT_APP_GUILD_BANNER_PAD || DEFAULT_BANNER_PAD));

function formatAssetCode(prefix, index) {
  return `${prefix}${String(index).padStart(bannerPad, '0')}`;
}

export const GUILD_BANNER_PRESETS = Array.from({ length: bannerCount }, (_, index) => {
  const bannerNumber = index + 1;
  const bannerCode = formatAssetCode(BANNER_FILE_PREFIX, bannerNumber);
  return {
    id: bannerCode,
    imageUrl: `/images/guild/${bannerCode}.png`,
  };
});

export const GUILD_FRACTION_PRESETS = [
  { id: FRACTION_NONE_ID, imageUrl: '' },
  ...Array.from({ length: fractionCount }, (_, index) => {
    const fractionNumber = index + 1;
    const fractionCode = formatAssetCode(FRACTION_FILE_PREFIX, fractionNumber);
    return {
      id: fractionCode,
      imageUrl: `/images/guild/${fractionCode}.png`,
    };
  }),
];

export function getPresetById(presetId) {
  return GUILD_BANNER_PRESETS.find((preset) => preset.id === presetId) || GUILD_BANNER_PRESETS[0];
}

export function getFractionPresetById(presetId) {
  return GUILD_FRACTION_PRESETS.find((preset) => preset.id === presetId) || GUILD_FRACTION_PRESETS[0];
}

function normalizeLegacyBannerPath(pathValue) {
  const value = String(pathValue || '').trim();
  if (!value) return '';
  const legacyMatch = value.match(/\/images\/guild\/banner(\d+)\.png$/i);
  if (!legacyMatch) return value;
  const legacyBannerCode = formatAssetCode(BANNER_FILE_PREFIX, Number(legacyMatch[1]));
  return `/images/guild/${legacyBannerCode}.png`;
}

function normalizeLegacyFractionPath(pathValue) {
  const value = String(pathValue || '').trim();
  if (!value) return '';
  const legacyMatch = value.match(/\/images\/guild\/fraction(\d+)\.png$/i);
  if (!legacyMatch) return value;
  const legacyFractionCode = formatAssetCode(FRACTION_FILE_PREFIX, Number(legacyMatch[1]));
  return `/images/guild/${legacyFractionCode}.png`;
}

function resolveBannerByUrl(candidateUrl) {
  const normalizedCandidate = normalizeLegacyBannerPath(candidateUrl);
  return (
    GUILD_BANNER_PRESETS.find((preset) => preset.imageUrl === normalizedCandidate) ||
    GUILD_BANNER_PRESETS[0]
  );
}

function resolveFractionByUrl(candidateUrl) {
  const normalizedCandidate = normalizeLegacyFractionPath(candidateUrl);
  if (!normalizedCandidate) return GUILD_FRACTION_PRESETS[0];
  return (
    GUILD_FRACTION_PRESETS.find((preset) => preset.imageUrl === normalizedCandidate) ||
    GUILD_FRACTION_PRESETS[0]
  );
}

export function serializeGuildVisualValue({ bannerUrl, fractionUrl }) {
  const resolvedBanner = resolveBannerByUrl(bannerUrl);
  const resolvedFraction = resolveFractionByUrl(fractionUrl);
  if (!resolvedFraction.imageUrl) return resolvedBanner.imageUrl;
  return `${resolvedBanner.imageUrl}${VISUAL_VALUE_SEPARATOR}${resolvedFraction.imageUrl}`;
}

export function parseGuildVisualValue(rawValue) {
  const value = String(rawValue || '').trim();
  if (!value) {
    return {
      banner: GUILD_BANNER_PRESETS[0],
      fraction: GUILD_FRACTION_PRESETS[0],
    };
  }

  if (value.startsWith('preset:')) {
    const presetId = value.slice('preset:'.length).trim();
    return {
      banner: getPresetById(presetId),
      fraction: GUILD_FRACTION_PRESETS[0],
    };
  }

  if (value.includes(VISUAL_VALUE_SEPARATOR)) {
    const [bannerPart, fractionPart] = value.split(VISUAL_VALUE_SEPARATOR);
    return {
      banner: resolveBannerByUrl(bannerPart),
      fraction: resolveFractionByUrl(fractionPart),
    };
  }

  return {
    banner: resolveBannerByUrl(value),
    fraction: GUILD_FRACTION_PRESETS[0],
  };
}

export function resolveBannerUrlFromValue(rawBannerValue) {
  return parseGuildVisualValue(rawBannerValue).banner.imageUrl;
}

export function getBannerPresentation(rawBannerUrl) {
  const { banner, fraction } = parseGuildVisualValue(rawBannerUrl);
  const hasFraction = Boolean(fraction.imageUrl);
  return {
    type: 'preset',
    presetId: banner.id,
    fractionPresetId: fraction.id,
    bannerUrl: banner.imageUrl,
    fractionUrl: fraction.imageUrl,
    style: {
      backgroundImage: hasFraction
        ? `url(${fraction.imageUrl}), url(${banner.imageUrl})`
        : `url(${banner.imageUrl})`,
      backgroundRepeat: hasFraction ? 'no-repeat, no-repeat' : 'no-repeat',
      backgroundSize: hasFraction
        ? `${Math.round(FRACTION_SCALE * 100)}% auto, 100% 100%`
        : '100% 100%',
      backgroundPosition: hasFraction ? `center ${FRACTION_TOP_PERCENT}%, center center` : 'center center',
    },
  };
}

