<Button
    type="button"
    variant="outline"
    className="h-9 px-3 rounded-full flex items-center gap-2"
    onClick={() => setShowAppointmentForm(true)}
    disabled={isLoading}
>
    <Calendar className="h-4 w-4" />
    <span className="text-sm">Đặt lịch</span>
</Button> 