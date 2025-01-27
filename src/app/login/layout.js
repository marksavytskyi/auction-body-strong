export default function AuthLayout({ children }) {
    return (
        <div className={"w-screen h-screen flex justify-center align-middle"}>
            <div className=" basis-3/5 relative h-full w-full bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 flex flex-col items-center justify-center text-center text-white">
                {/* Circular Design Background */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-[500px] h-[500px] border-2 border-blue-400 rounded-full opacity-10"></div>
                    <div className="w-[600px] h-[600px] border-2 border-blue-400 rounded-full opacity-10 absolute"></div>
                </div>

                {/* Content */}
                <div className="relative z-10">
                    <h1 className="text-4xl font-bold mb-4">
                        AuctionBody
                    </h1>
                    <p className="text-lg font-light mb-8">
                        Convert auctions CSV file to managed table.
                    </p>
                </div>
            </div>


            <div className={"basis-2/5 flex flex-1 justify-center align-middle"}>
                {children}
            </div>

        </div>
    )
}