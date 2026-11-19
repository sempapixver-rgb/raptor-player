import Foundation

/// Agrupa episódios soltos de uma M3U em série → temporada → episódio.
enum M3uSeries {
    private struct Bucket {
        var title: String
        var cover: String?
        var genres: [String] = []
        var episodes: [String: Episode] = [:]
    }

    static func build(from entries: [MediaEntry]) -> [SeriesDetail] {
        var buckets: [String: Bucket] = [:]
        var order: [String] = []
        var loose = 0

        for entry in entries where entry.kind == .series {
            let parts: (series: String, season: Int, episode: Int)
            if let split = M3uParser.splitEpisode(entry.name) {
                parts = split
            } else {
                loose += 1
                parts = (entry.name.trimmingCharacters(in: .whitespacesAndNewlines), 1, loose)
            }
            let key = RaptorUtil.fold(parts.series)
            guard !key.isEmpty else { continue }

            if buckets[key] == nil {
                buckets[key] = Bucket(title: parts.series, cover: entry.logo)
                order.append(key)
            }
            if buckets[key]?.cover == nil, let logo = entry.logo, !logo.isEmpty {
                buckets[key]?.cover = logo
            }
            for genre in entry.allCategoryIds() {
                if let bucket = buckets[key], !bucket.genres.contains(genre) {
                    buckets[key]?.genres.append(genre)
                }
            }

            let number = parts.episode > 0 ? parts.episode : (buckets[key]?.episodes.count ?? 0) + 1
            let title = episodeTitle(entry.name, series: parts.series, season: parts.season, number: number)
            let episode = Episode(
                id: entry.id,
                title: title,
                season: parts.season,
                number: number,
                url: entry.directUrl ?? "",
                logo: entry.logo
            )
            let dedupeKey = (entry.directUrl?.isEmpty == false)
                ? "url:\(entry.directUrl ?? "")"
                : "num:\(parts.season)e\(number)-\(title.lowercased())"
            if buckets[key]?.episodes[dedupeKey] == nil {
                buckets[key]?.episodes[dedupeKey] = episode
            }
        }

        return order.compactMap { key in
            guard let bucket = buckets[key] else { return nil }
            let bySeason = Dictionary(grouping: bucket.episodes.values) { $0.season }
            let seasons = bySeason.keys.sorted().map { number in
                Season(number: number, episodes: (bySeason[number] ?? []).sorted {
                    if $0.number != $1.number { return $0.number < $1.number }
                    return $0.title.lowercased() < $1.title.lowercased()
                })
            }
            return SeriesDetail(
                id: "s-" + RaptorUtil.hexJavaHash(key),
                name: bucket.title,
                cover: bucket.cover,
                seasons: seasons,
                genres: bucket.genres
            )
        }
    }

    private static func episodeTitle(_ original: String, series: String, season: Int, number: Int) -> String {
        var result = original
        let foldedOriginal = RaptorUtil.fold(original)
        let foldedSeries = RaptorUtil.fold(series)
        if !foldedSeries.isEmpty, foldedOriginal.hasPrefix(foldedSeries),
           let index = original.range(of: series, options: .caseInsensitive) {
            result = String(original[index.upperBound...])
        }
        result = result.trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: "-._ "))
        return result.isEmpty ? "T\(season) E\(number)" : result
    }
}
