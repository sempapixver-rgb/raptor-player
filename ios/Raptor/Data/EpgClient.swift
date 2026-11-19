import Foundation

/// Busca a grade do meuguia.tv com as mesmas regexes do EpgClient.kt.
final class EpgClient {
    private let base = "https://meuguia.tv"
    private let categories = ["Filmes", "Series", "Esportes", "Infantil", "Variedades", "Documentarios", "Noticias", "Aberta"]
    private var boardCache: [String: [Entry]] = [:]
    private var boardTime: Date?
    private var scheduleCache: [String: [EpgProgram]] = [:]
    private var scheduleTime: Date?
    private static let ttl: TimeInterval = 10 * 60

    struct Entry {
        let code: String
        let name: String
        let programs: [EpgProgram]
    }

    func board() async -> [Entry] {
        if let boardTime, Date().timeIntervalSince(boardTime) < Self.ttl, !boardCache.isEmpty {
            return boardCache.flatMap { $0.value }
        }
        var result: [String: [Entry]] = [:]
        await withTaskGroup(of: (String, [Entry]).self) { group in
            for category in categories {
                group.addTask {
                    let path = "/programacao/categoria/\(category)"
                    let entries = (try? await self.get(path)).map { Self.parseBoard($0) } ?? []
                    return (category, entries)
                }
            }
            for await (category, entries) in group {
                result[category] = entries
            }
        }
        boardCache = result
        boardTime = Date()
        return result.values.flatMap { $0 }
    }

    func schedule(code: String) async -> [EpgProgram] {
        if let scheduleTime, Date().timeIntervalSince(scheduleTime) < Self.ttl,
           let cached = scheduleCache[code] {
            return cached
        }
        guard let html = try? await get("/programacao/canal/\(code)") else { return [] }
        let programs = Self.parseSchedule(html)
        scheduleCache[code] = programs
        scheduleTime = Date()
        return programs
    }

    /// Casamento por aproximação de nome igual ao Android.
    func find(_ channelName: String, in entries: [Entry]) async -> EpgProgram? {
        let target = RaptorUtil.fold(channelName)
        guard !target.isEmpty else { return nil }
        var matched: Entry?
        let stripped = RaptorUtil.stripQuality(target)

        if let exact = entries.first(where: { RaptorUtil.fold($0.name) == target }) { matched = exact }
        if matched == nil { matched = entries.first { RaptorUtil.stripQuality($0.name) == stripped } }
        if matched == nil {
            let compact = target.components(separatedBy: .whitespaces).joined()
            matched = entries.first {
                RaptorUtil.fold($0.name).components(separatedBy: .whitespaces).joined() == compact
            }
        }
        if matched == nil {
            matched = entries.first {
                let other = RaptorUtil.fold($0.name)
                return target.hasPrefix(other) || other.hasPrefix(target)
            }
        }
        if matched == nil {
            matched = entries.first {
                let other = RaptorUtil.fold($0.name)
                return !other.isEmpty && target.contains(" \(other)")
            }
        }
        guard let matched else { return nil }
        let programs = await schedule(code: matched.code)
        let now = currentMinutes()
        return programs.last { $0.startMinutes <= now } ?? programs.first
    }

    func epg(for channelName: String, entries: [Entry]? = nil) async -> ChannelEpg? {
        let list: [Entry]
        if let entries {
            list = entries
        } else {
            list = await board()
        }
        guard let matched = await matchEntry(channelName, in: list) else { return nil }
        let programs = await schedule(code: matched.code)
        guard !programs.isEmpty else { return nil }
        return ChannelEpg(channelName: channelName, programs: programs)
    }

    private func matchEntry(_ channelName: String, in entries: [Entry]) async -> Entry? {
        let target = RaptorUtil.fold(channelName)
        let stripped = RaptorUtil.stripQuality(target)
        if let exact = entries.first(where: { RaptorUtil.fold($0.name) == target }) { return exact }
        if let q = entries.first(where: { RaptorUtil.stripQuality($0.name) == stripped }) { return q }
        let compact = target.components(separatedBy: .whitespaces).joined()
        if let c = entries.first(where: {
            RaptorUtil.fold($0.name).components(separatedBy: .whitespaces).joined() == compact
        }) { return c }
        if let p = entries.first(where: {
            let other = RaptorUtil.fold($0.name)
            return target.hasPrefix(other) || other.hasPrefix(target)
        }) { return p }
        return entries.first {
            let other = RaptorUtil.fold($0.name)
            return !other.isEmpty && target.contains(" \(other)")
        }
    }

    private func currentMinutes() -> Int {
        let comps = Calendar.current.dateComponents([.hour, .minute], from: Date())
        return (comps.hour ?? 0) * 60 + (comps.minute ?? 0)
    }

    private func get(_ path: String) async throws -> String {
        let url = URL(string: path.hasPrefix("http") ? path : base + path)!
        var request = URLRequest(url: url)
        request.timeoutInterval = 25
        request.setValue("Mozilla/5.0 (iOS) Raptor/1.2", forHTTPHeaderField: "User-Agent")
        let (data, _) = try await URLSession.shared.data(for: request)
        return String(data: data, encoding: .utf8) ?? ""
    }

    // MARK: - HTML parsing

    private static func parseBoard(_ html: String) -> [Entry] {
        let blockPattern = #"href="/programacao/canal/([A-Za-z0-9]+)"[^>]*>(.*?)</a>"#
        let h2 = #"<h2>(.*?)</h2>"#
        let h3 = #"<h3[^>]*>(.*?)</h3>"#
        let time = #"<strong>\s*(\d{1,2}:\d{2})\s*</strong>"#
        let progress = #"<div class="progressbar">.*?</div>"#

        guard let blocks = matches(blockPattern, in: html, options: [.dotMatchesLineSeparators, .caseInsensitive]) else { return [] }
        return blocks.compactMap { block in
            guard let code = group(1, in: block, text: html),
                  let blockRange = Range(block.range, in: html) else { return nil }
            let blockText = String(html[blockRange])
            guard let h2Match = firstMatch(h2, in: blockText, options: .dotMatchesLineSeparators) else { return nil }
            let name = clean(group(0, in: h2Match, text: blockText))
            guard !name.isEmpty else { return nil }
            var programs: [EpgProgram] = []
            if let h3s = matches(h3, in: blockText, options: .dotMatchesLineSeparators) {
                for item in h3s {
                    guard let itemRange = Range(item.range, in: blockText) else { continue }
                    let raw = String(blockText[itemRange])
                    guard let timeMatch = firstMatch(time, in: raw) else { continue }
                    let start = group(1, in: timeMatch, text: raw)
                    let title = clean(strip(progress, from: raw).replacingOccurrences(of: start, with: ""))
                    guard !title.isEmpty else { continue }
                    programs.append(EpgProgram(
                        startMinutes: RaptorUtil.toMinutes(start), start: start, title: title
                    ))
                }
            }
            guard !programs.isEmpty else { return nil }
            return Entry(code: code, name: name, programs: programs)
        }
    }

    private static func parseSchedule(_ html: String) -> [EpgProgram] {
        let headerPattern = #"<li class="subheader devicepadding">(?!<%)"#
        let dayRanges = matches(headerPattern, in: html) ?? []
        let start = dayRanges.first.flatMap { Range($0.range, in: html) }?.lowerBound ?? html.startIndex
        let endRange = dayRanges.count > 1 ? Range(dayRanges[1].range, in: html) : nil
        let end = endRange?.lowerBound ?? html.endIndex
        let slice = String(html[start..<end])

        let pattern = #"<div class='lileft time'>\s*(\d{1,2}:\d{2})\s*</div>\s*<div class="licontent">\s*<h2>(.*?)</h2>\s*<h3>(.*?)</h3>"#
        guard let found = matches(pattern, in: slice, options: [.dotMatchesLineSeparators, .caseInsensitive]) else { return [] }
        return found.compactMap { match in
            let time = group(1, in: match, text: slice)
            let title = clean(group(2, in: match, text: slice))
            let genre = clean(group(3, in: match, text: slice))
            guard !time.isEmpty, !title.isEmpty else { return nil }
            return EpgProgram(
                startMinutes: RaptorUtil.toMinutes(time), start: time, title: title,
                genre: genre.isEmpty ? nil : genre
            )
        }
    }

    private static func matches(_ pattern: String, in text: String, options: NSRegularExpression.Options = []) -> [NSTextCheckingResult]? {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: options) else { return nil }
        return regex.matches(in: text, range: NSRange(text.startIndex..., in: text))
    }

    private static func firstMatch(_ pattern: String, in text: String, options: NSRegularExpression.Options = []) -> NSTextCheckingResult? {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: options) else { return nil }
        return regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text))
    }

    private static func group(_ index: Int, in match: NSTextCheckingResult, text: String) -> String {
        guard index < match.numberOfRanges,
              let range = Range(match.range(at: index), in: text) else { return "" }
        return String(text[range])
    }

    private static func strip(_ pattern: String, from text: String) -> String {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: .dotMatchesLineSeparators) else { return text }
        let range = NSRange(text.startIndex..., in: text)
        return regex.stringByReplacingMatches(in: text, range: range, withTemplate: "")
    }

    private static func clean(_ raw: String) -> String {
        var s = raw
        guard let tagRegex = try? NSRegularExpression(pattern: "<[^>]*>") else { return raw }
        s = tagRegex.stringByReplacingMatches(in: s, range: NSRange(s.startIndex..., in: s), withTemplate: "")
        let entities = [
            "&nbsp;": " ", "&amp;": "&", "&quot;": "\"", "&#39;": "'",
            "&apos;": "'", "&lt;": "<", "&gt;": ">"
        ]
        for (key, value) in entities { s = s.replacingOccurrences(of: key, with: value) }
        if let numeric = try? NSRegularExpression(pattern: "&#(\\d+);") {
            let matches = numeric.matches(in: s, range: NSRange(s.startIndex..., in: s)).reversed()
            for match in matches {
                guard let r = Range(match.range(at: 1), in: s),
                      let code = Int(s[r]),
                      let scalar = UnicodeScalar(code),
                      let whole = Range(match.range, in: s) else { continue }
                s.replaceSubrange(whole, with: String(Character(scalar)))
            }
        }
        s = s.replacingOccurrences(of: "\u{00A0}", with: " ")
        let parts = s.components(separatedBy: .whitespacesAndNewlines).filter { !$0.isEmpty }
        return parts.joined(separator: " ")
    }
}
