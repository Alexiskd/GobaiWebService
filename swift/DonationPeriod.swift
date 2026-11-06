import Foundation

/// Date et heure du mois de dons de Gobai Space, calculées comme le backend :
/// mois civil en heure de Paris, remise à zéro du plafond le 1er à 00:00 (changement d'heure compris).
struct DonationPeriod {
    static let timeZone = TimeZone(identifier: "Europe/Paris")!
    static let monthlyLimit: Decimal = 3400

    /// Mois `AAAA-MM`, identique au champ `month` de `GET /api/v1/donations/config`.
    let month: String
    /// Début du mois (inclus).
    let startsAt: Date
    /// Remise à zéro du plafond : 1er du mois suivant à 00:00, heure de Paris.
    let resetsAt: Date

    init(now: Date = Date()) {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = Self.timeZone
        let parts = calendar.dateComponents([.year, .month], from: now)
        startsAt = calendar.date(from: parts)!
        resetsAt = calendar.date(byAdding: .month, value: 1, to: startsAt)!
        month = String(format: "%04d-%02d", parts.year!, parts.month!)
    }

    /// « 1 décembre 2026 à 00:00 », en français et à l'heure de Paris.
    static func frenchDateTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "fr_FR")
        formatter.timeZone = timeZone
        formatter.dateFormat = "d MMMM yyyy 'à' HH:mm"
        return formatter.string(from: date)
    }

    /// Lit une date ISO 8601 renvoyée par l'API (ex. `resetsAt` = "2026-11-30T23:00:00.000Z").
    static func parseAPIDate(_ iso: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
    }
}

// Exemple :
// let period = DonationPeriod()
// print("Collecte \(period.month), remise à zéro le \(DonationPeriod.frenchDateTime(period.resetsAt))")
