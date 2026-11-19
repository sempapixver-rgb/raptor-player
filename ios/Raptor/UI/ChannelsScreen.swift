import SwiftUI

private let channelPageSize = 60

struct ChannelsScreen: View {
    @EnvironmentObject private var store: RaptorStore
    @Binding var route: PlayerRoute?

    @State private var categories: [Category] = []
    @State private var selectedCategory: String?
    @State private var items: [MediaEntry] = []
    @State private var query = ""
    @State private var filter = 0
    @State private var loading = true
    @State private var errorMessage = ""
    @State private var page = 0
    @State private var selected: MediaEntry?
    @State private var epg: ChannelEpg?
    @State private var resolving = false
    @State private var toast = ""
    @State private var epgClient = EpgClient()

    private let filters = ["Todos", "Favoritos", "Recentes"]

    var body: some View {
        ZStack {
            VStack(spacing: 8) {
                SearchField(text: $query, placeholder: "Buscar canais")
                    .padding(.horizontal, 16)
                    .padding(.top, 8)

                Picker("Filtro", selection: $filter) {
                    ForEach(0..<filters.count, id: \.self) { Text(filters[$0]) }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 16)

                CategoryChips(categories: categories, selected: $selectedCategory)

                if loading {
                    StateView(.loading("Carregando canais…"))
                } else if !errorMessage.isEmpty {
                    StateView(.error(errorMessage)) { Task { await load() } }
                } else if displayed.isEmpty {
                    StateView(.empty(emptyMessage))
                } else {
                    List {
                        ForEach(Array(displayed.enumerated()), id: \.element.id) { index, entry in
                            channelRow(entry, index: index)
                        }
                    }
                    .listStyle(.plain)
                    .scrollContentBackground(.hidden)

                    if filtered.count > channelPageSize {
                        PagerBar(page: page, total: totalPages,
                                 onPrevious: { page = max(0, page - 1) },
                                 onNext: { page = min(totalPages - 1, page + 1) })
                    }
                }

                if let channel = selected {
                    epgPanel(channel)
                        .padding(.horizontal, 16)
                        .padding(.bottom, 8)
                }
            }

            if resolving {
                ZStack {
                    Color.black.opacity(0.6).ignoresSafeArea()
                    VStack(spacing: 8) {
                        ProgressView().tint(RaptorColor.green)
                        Text("Abrindo…").font(.subheadline).foregroundStyle(RaptorColor.green)
                        Text("Conectando ao servidor").font(.caption).foregroundStyle(RaptorColor.dim)
                    }
                }
            }

            if !toast.isEmpty {
                VStack {
                    Spacer()
                    Text(toast)
                        .font(.caption)
                        .foregroundStyle(.white)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(Color(red: 0.72, green: 0.11, blue: 0.11))
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .padding(.bottom, 12)
                }
            }
        }
        .task { await load() }
        .onChange(of: selectedCategory) { _ in page = 0; Task { await loadItems() } }
        .onChange(of: filter) { _ in page = 0 }
        .onChange(of: query) { _ in page = 0 }
        .onChange(of: store.favorites) { _ in Task { await loadItems() } }
    }

    private var filtered: [MediaEntry] {
        let base: [MediaEntry]
        if filter == 1 {
            base = store.favorites.filter { $0.kind == .live }
        } else if filter == 2 {
            base = store.recents.filter { $0.kind == .live }
        } else {
            let searchIndex = query.count >= 2 ? store.searchCache[.live] : nil
            base = searchIndex ?? items
        }
        let needle = query.trimmingCharacters(in: .whitespaces)
        return needle.isEmpty ? base : base.filter { $0.name.localizedCaseInsensitiveContains(needle) }
    }

    private var displayed: [MediaEntry] {
        let start = min(page * channelPageSize, max(0, filtered.count - 1))
        return Array(filtered.dropFirst(start).prefix(channelPageSize))
    }

    private var totalPages: Int {
        max(1, Int(ceil(Double(filtered.count) / Double(channelPageSize))))
    }

    private var emptyMessage: String {
        if !query.isEmpty { return "Nenhum resultado para \"\(query)\"." }
        if filter == 1 { return "Nenhum canal favorito." }
        if filter == 2 { return "Nenhum canal visto ainda." }
        return "Nenhum canal nesta categoria."
    }

    private func load() async {
        loading = true
        errorMessage = ""
        let cats = await store.categories(.live)
        await MainActor.run { categories = cats }
        await loadItems()
        await MainActor.run { loading = false }
    }

    private func loadItems() async {
        errorMessage = ""
        let result = await store.items(.live, categoryId: selectedCategory)
        await MainActor.run { items = result }
        if query.count >= 2 {
            let all = await store.allItems(.live)
            await MainActor.run { store.searchCache[.live] = all }
        }
    }

    @ViewBuilder
    private func channelRow(_ entry: MediaEntry, index: Int) -> some View {
        HStack(spacing: 10) {
            Text("\(index + 1 + page * channelPageSize)")
                .font(.caption)
                .foregroundStyle(RaptorColor.dim)
                .frame(width: 28, alignment: .trailing)

            if let logo = entry.logo, let url = URL(string: logo) {
                AsyncImage(url: url) { phase in
                    if case .success(let image) = phase {
                        image.resizable().scaledToFit()
                    } else {
                        Image(systemName: "tv").foregroundStyle(RaptorColor.dim)
                    }
                }
                .frame(width: 36, height: 36)
                .background(RaptorColor.surfaceHigh)
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }

            Button {
                selected = entry
                Task { await loadEPG(for: entry) }
                Task { await play(entry) }
            } label: {
                Text(entry.name)
                    .font(.subheadline)
                    .lineLimit(1)
                    .foregroundStyle(RaptorColor.text)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            Button {
                store.toggleFavorite(entry)
            } label: {
                Image(systemName: store.isFavorite(entry) ? "star.fill" : "star")
                    .foregroundStyle(store.isFavorite(entry) ? Color(red: 1, green: 0.76, blue: 0.07) : RaptorColor.dim)
            }
            .buttonStyle(.plain)
        }
        .padding(.vertical, 4)
        .listRowBackground(RaptorColor.surface.opacity(0.5))
    }

    private func loadEPG(for entry: MediaEntry) async {
        let result = await epgClient.epg(for: entry.name)
        await MainActor.run { epg = result }
    }

    @ViewBuilder
    private func epgPanel(_ channel: MediaEntry) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(channel.name)
                    .font(.subheadline.weight(.bold))
                    .lineLimit(1)
                Spacer()
                Text("AO VIVO")
                    .font(.caption2.weight(.bold))
                    .padding(.horizontal, 6)
                    .padding(.vertical, 3)
                    .background(Color(red: 0.83, green: 0.18, blue: 0.18))
                    .clipShape(RoundedRectangle(cornerRadius: 4))
            }
            Button {
                Task { await play(channel) }
            } label: {
                Text("▶ Assistir")
                    .font(.caption.weight(.bold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 9)
                    .background(RaptorColor.green)
                    .foregroundStyle(RaptorColor.black)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
            }

            if let epg {
                SectionLabel(text: "AGORA")
                Text(epg.programs.first?.title ?? "Programação indisponível")
                    .font(.caption)
                    .foregroundStyle(RaptorColor.text)
                SectionLabel(text: "A SEGUIR")
                ForEach(epg.programs.dropFirst().prefix(3)) { program in
                    HStack(spacing: 8) {
                        Text(program.start).font(.caption2).foregroundStyle(RaptorColor.green)
                        Text(program.title).font(.caption2).foregroundStyle(RaptorColor.dim).lineLimit(1)
                    }
                }
            }
        }
        .padding(12)
        .background(RaptorColor.surface)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(RaptorColor.outline, lineWidth: 1))
    }

    private func play(_ entry: MediaEntry) async {
        resolving = true
        var queue: [PlayItem] = []
        for item in displayed {
            if let url = await store.playUrl(item), !url.isEmpty {
                queue.append(PlayItem(url: url, title: item.name))
            }
        }
        await MainActor.run {
            resolving = false
            if queue.isEmpty {
                toast = "Item sem link de reprodução"
            } else {
                let start = queue.firstIndex { $0.title == entry.name } ?? 0
                store.addRecent(entry)
                route = PlayerRoute(items: queue, startIndex: start, autoAdvance: false)
            }
        }
    }
}
