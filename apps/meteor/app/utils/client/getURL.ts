import { settings } from '../../../client/lib/settings';
import { getURLWithoutSettings } from '../lib/getURL';
import { Info } from '../rocketchat.info';

export const getURL = function (
	path: string, // eslint-disable-next-line @typescript-eslint/naming-convention
	params: {
		cdn?: boolean;
		full?: boolean;
		cloud?: boolean;
		cloud_route?: string;
		cloud_params?: Record<string, string>;
	} = {},
	cloudDeepLinkUrl?: string,
	cacheKey?: boolean,
): string {
	const cdnPrefix = settings.watch('CDN_PREFIX') || '';
	const siteUrl = settings.watch('Site_Url') || '';

	const isLocalhost =
		typeof window !== 'undefined' &&
		(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

	const runtimeRootUrl =
		typeof __meteor_runtime_config__ !== 'undefined' ? __meteor_runtime_config__.ROOT_URL || window.location.origin : '';

	const resolvedSiteUrl = params.full && isLocalhost ? runtimeRootUrl : siteUrl;

	if (cacheKey) {
		path += `${path.includes('?') ? '&' : '?'}cacheKey=${Info.version}`;
	}

	return getURLWithoutSettings(path, params, cdnPrefix, resolvedSiteUrl, cloudDeepLinkUrl);
};
