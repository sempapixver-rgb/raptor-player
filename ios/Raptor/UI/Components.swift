import SwiftUI

struct CoverImage: View {
    let url: String?
    var ratio: CGFloat = 2.0 / 3.0

    var body: some View {
        Group {
            if let url, let remote = URL(string: url) {
                AsyncImage(url: remote) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFill()
                    case .failure, .empty:
                        placeholder
                    @unknown default:
                        placeholder
                    }
                }
            } else {
                placeholder
            }
        }
        .aspectRatio(ratio, contentMode: .fill)
        .clipped()
    }

    private var placeholder: some View {
        ZStack {
            RaptorColor.surfaceHigh
            Image(systemName: "play.rectangle")
                .font(.title)
                .foregroundStyle(RaptorColor.outline)
        }
    }
}

struct CategoryChips: View {
    let categories: [Category]
    @Binding var selected: String?
    var showAll = true

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                if showAll {
                    chip(id: nil, name: "Tudo")
                }
                ForEach(categories) { category in
                    chip(id: category.id, name: category.name)
                }
            }
            .padding(.horizontal, 16)
        }
    }

    private func chip(id: String?, name: String) -> some View {
        let isSelected = selected == id
        return Button {
            selected = id
        } label: {
            Text(name)
                .font(.caption.weight(.semibold))
                .lineLimit(1)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(isSelected ? RaptorColor.green.opacity(0.18) : RaptorColor.surfaceHigh)
                .foregroundStyle(isSelected ? RaptorColor.green : RaptorColor.dim)
                .clipShape(Capsule())
                .overlay(
                    Capsule().stroke(isSelected ? RaptorColor.green : RaptorColor.outline, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
    }
}

struct PagerBar: View {
    let page: Int
    let total: Int
    let onPrevious: () -> Void
    let onNext: () -> Void

    var body: some View {
        HStack {
            Button(action: onPrevious) {
                Label("Voltar", systemImage: "chevron.left")
            }
            .disabled(page <= 0)
            Spacer()
            Text("Página \(page + 1) de \(max(1, total))")
                .font(.caption)
                .foregroundStyle(RaptorColor.dim)
            Spacer()
            Button(action: onNext) {
                Label("Próximo", systemImage: "chevron.right")
            }
            .disabled(page >= total - 1)
        }
        .font(.caption)
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
    }
}

struct PosterGrid<Content: View>: View {
    let columns: Int
    let items: [MediaEntry]
    @ViewBuilder let content: (MediaEntry) -> Content

    var body: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: columns), spacing: 14) {
            ForEach(items) { item in
                content(item)
            }
        }
        .padding(16)
    }
}
