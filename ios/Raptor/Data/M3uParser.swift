import Foundation

/// Parser M3U com a mesma classificação do M3uParser.kt (canal / filme / série).
enum M3uParser {
    private static let attributeRegex = try? NSRegularExpression(pattern: #"([a-zA-Z0-9_-]+)="([^"]*)""#)

    static func parse(_ text: String) -> [MediaEntry] {
        var out: [MediaEntry] = []
        var pendingTitle: String?
        var pendingLogo: String?
        var pendingGroup: String?

        func flush(with url: String) {
            guard let title = pendingTitle, !url.trimmingCharacters(in: .whitespaces).isEmpty else { return }
            out.append(MediaEntry(
                id: "m3u-\(out.count)",
                name: title,
                logo: pendingLogo,
                categoryId: pendingGroup,
                kind: classify(url: url, group: pendingGroup, title: title),
                directUrl: url.trimmingCharacters(in: .whitespacesAndNewlines)
            ))
            pendingTitle = nil
            pendingLogo = nil
            pendingGroup = nil
        }

        for rawLine in text.split(whereSeparator: { $0.isNewline }) {
            let line = String(rawLine).trimmingCharacters(in: .whitespacesAndNewlines)
            if line.isEmpty { continue }

            if line.hasPrefix("#EXTINF") {
                var attrs: [String: String] = [:]
                let range = NSRange(line.startIndex..., in: line)
                attributeRegex?.enumerateMatches(in: line, range: range) { match, _, _ in
                    guard let match,
                          let keyRange = Range(match.range(at: 1), in: line),
                          let valueRange = Range(match.range(at: 2), in: line) else { return }
                    attrs[String(line[keyRange]).lowercased()] = String(line[valueRange])
                }
                pendingTitle = line.components(separatedBy: ",").last?
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                if pendingTitle?.isEmpty == true { pendingTitle = "Sem título" }
                pendingLogo = attrs["tvg-logo"]
                pendingGroup = attrs["group-title"] ?? attrs["tvg-group"]
                continue
            }

            if line.hasPrefix("#") { continue }

            if pendingTitle != nil {
                flush(with: line)
            }
        }
        return out
    }

    // MARK: - Classificação

    static func classify(url: String, group: String?, title: String) -> MediaKind {
        let foldedGroup = RaptorUtil.fold(group ?? "")
        if isLiveCategory(foldedGroup) { return .live }

        let lower = url.lowercased()
        if lower.contains("/series/") { return .series }
        if lower.contains("/movie/") { return .vod }
        if lower.contains("/live/") { return .live }

        if splitEpisode(title) != nil { return .series }

        let hasAny = { (tokens: [String]) in tokens.contains { foldedGroup.contains($0) } }
        if hasAny(["serie", "temporada", "novela", "anime", "dorama", "shows", "show "]) { return .series }
        if hasAny(["filme", "movie", "vod", "cinema", "lancamento", "trailer"]) { return .vod }
        if hasAny(["ao vivo", "live", "noticia", "infantil", "documentario"]) { return .live }

        let path = url.components(separatedBy: "?").first ?? url
        let ext = (path as NSString).pathExtension.lowercased()
        if ["mp4", "mkv", "avi", "mov", "webm"].contains(ext) { return .vod }
        if ["m3u8", "ts"].contains(ext) { return .live }
        return .live
    }

    private static func isLiveCategory(_ group: String) -> Bool {
        let hasAny = { (tokens: [String]) in tokens.contains { group.contains($0) } }
        let movieAndSeries = hasAny([
            "filmes e series", "filmes series", "filmes serie", "series e filmes",
            "series filmes", "filmes & series", "series & filmes"
        ])
        if movieAndSeries { return true }
        let looksMovie = group == "filme" || group == "filmes" ||
            group.hasPrefix("filme ") || group.hasPrefix("filmes ")
        if looksMovie { return false }
        return hasAny([
            "canais", "canal ", "ao vivo", "futebol", "esporte", "noticia",
            "infantil", "documentario", "variedade", "aberta", "assinatura",
            "ppv", "adulto", "jogos brasileirao", "brasileirao", "campeonato",
            "copa", "nba", "nfl", "ufc", "luta", "combate", "premiere",
            "radio", "24h", "24 horas", "live"
        ])
    }

    // MARK: - Episódios

    static func splitEpisode(_ title: String) -> (series: String, season: Int, episode: Int)? {
        let patterns = [
            #"^(.*?)[\s._\-\[\]]*[Ss](\d{1,2})[\s._\-]*[Ee](\d{1,3})(?:\D.*)?$"#,
            #"^(.*?)[\s._\-\[\]]*(\d{1,2})\s*[xX]\s*(\d{1,3})(?:\D.*)?$"#,
            #"^(.*?)[\s._\-]*[Tt]emporada\s*(\d{1,2})[\s._\-]*[Ee]p(?:is[oó]dio)?\s*(\d{1,3})(?:\D.*)?$"#
        ]
        for pattern in patterns {
            guard let regex = try? NSRegularExpression(pattern: pattern) else { continue }
            let range = NSRange(title.startIndex..., in: title)
            guard let match = regex.firstMatch(in: title, range: range),
                  match.numberOfRanges >= 4,
                  let a = Range(match.range(at: 1), in: title),
                  let b = Range(match.range(at: 2), in: title),
                  let c = Range(match.range(at: 3), in: title),
                  let season = Int(String(title[b])),
                  let episode = Int(String(title[c])) else { continue }
            let series = String(title[a]).trimmingCharacters(in: .whitespacesAndNewlines)
                .trimmingCharacters(in: CharacterSet(charactersIn: "-._ "))
            return (series, season, episode)
        }
        return nil
    }
}
